/**
 * DVA Route - Dedicated Virtual Account provisioning
 * 
 * Endpoints:
 * - POST /api/dva/provision - Create DVA for a student
 * - GET /api/dva/:student_id - Get DVA details for a student
 */

import express from 'express';
import { supabase } from '../supabaseClient.js';
import { MonnifyGateway } from '../services/gateways/MonnifyGateway.js';

const router = express.Router();

// Get gateway instance
const monnifyGateway = new MonnifyGateway();

// POST /api/dva/provision
// Creates a Dedicated Virtual Account for a student
router.post('/provision', async (req, res) => {
  const { student_id, school_id } = req.body;

  if (!student_id || !school_id) {
    return res.status(400).json({ error: 'student_id and school_id are required' });
  }

  try {
    // Verify student exists and belongs to school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', student_id)
      .eq('school_id', school_id)
      .eq('status', 'ACTIVE')
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found or not active' });
    }

    // Get gateway config for school
    const { data: gatewayConfig, error: configError } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !gatewayConfig) {
      return res.status(404).json({ error: 'No active payment gateway configured for school' });
    }

    // Check if DVA already exists
    const { data: existingDVA } = await supabase
      .from('dva_assignments')
      .select('*')
      .eq('student_id', student_id)
      .eq('is_active', true)
      .single();

    if (existingDVA) {
      return res.json({
        success: true,
        already_exists: true,
        dva: existingDVA,
      });
    }

    // Create DVA via gateway
    const studentName = `${student.first_name} ${student.last_name}`;
    const dvaDetails = await monnifyGateway.createDVA({
      student_id,
      student_name: studentName,
      guardian_phone: student.guardian_phone,
      gateway_config: gatewayConfig,
      school_id,
    });

    // Save DVA assignment to database
    const { data: dvaAssignment, error: dvaError } = await supabase
      .from('dva_assignments')
      .insert({
        school_id,
        student_id,
        provider: gatewayConfig.provider,
        dva_account_number: dvaDetails.dva_account_number,
        dva_bank_name: dvaDetails.dva_bank_name,
        dva_account_name: dvaDetails.dva_account_name,
        is_active: true,
      })
      .select()
      .single();

    if (dvaError) {
      return res.status(500).json({ error: `Failed to save DVA: ${dvaError.message}` });
    }

    // Also update student record with DVA info
    await supabase
      .from('students')
      .update({
        dva_account_number: dvaDetails.dva_account_number,
        dva_bank_name: dvaDetails.dva_bank_name,
      })
      .eq('id', student_id);

    return res.json({
      success: true,
      dva: dvaAssignment,
    });

  } catch (error) {
    console.error('DVA provisioning error:', error);
    return res.status(500).json({ error: 'Failed to provision DVA', details: error.message });
  }
});

// GET /api/dva/:student_id
// Get DVA details for a student
router.get('/:student_id', async (req, res) => {
  const { student_id } = req.params;
  const { school_id } = req.query;

  if (!school_id) {
    return res.status(400).json({ error: 'school_id query parameter required' });
  }

  try {
    const { data: dva, error } = await supabase
      .from('dva_assignments')
      .select('*')
      .eq('student_id', student_id)
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (error || !dva) {
      return res.status(404).json({ error: 'DVA not found for student' });
    }

    return res.json({ success: true, dva });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch DVA', details: error.message });
  }
});

// POST /api/dva/bulk-provision
// Provision DVAs for multiple students
router.post('/bulk-provision', async (req, res) => {
  const { school_id } = req.body;

  if (!school_id) {
    return res.status(400).json({ error: 'school_id is required' });
  }

  try {
    // Get all active students without DVA
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', school_id)
      .eq('status', 'ACTIVE')
      .is('dva_account_number', null);

    if (studentsError) {
      return res.status(500).json({ error: studentsError.message });
    }

    // Get gateway config
    const { data: gatewayConfig, error: configError } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !gatewayConfig) {
      return res.status(404).json({ error: 'No active payment gateway configured' });
    }

    const results = [];
    
    for (const student of students) {
      try {
        const studentName = `${student.first_name} ${student.last_name}`;
        const dvaDetails = await monnifyGateway.createDVA({
          student_id: student.id,
          student_name: studentName,
          guardian_phone: student.guardian_phone,
          gateway_config: gatewayConfig,
          school_id,
        });

        // Save to database
        const { data: dva } = await supabase
          .from('dva_assignments')
          .insert({
            school_id,
            student_id: student.id,
            provider: gatewayConfig.provider,
            dva_account_number: dvaDetails.dva_account_number,
            dva_bank_name: dvaDetails.dva_bank_name,
            dva_account_name: dvaDetails.dva_account_name,
            is_active: true,
          })
          .select()
          .single();

        // Update student record
        await supabase
          .from('students')
          .update({
            dva_account_number: dvaDetails.dva_account_number,
            dva_bank_name: dvaDetails.dva_bank_name,
          })
          .eq('id', student.id);

        results.push({ student_id: student.id, success: true, dva });
      } catch (err) {
        results.push({ student_id: student.id, success: false, error: err.message });
      }
    }

    return res.json({
      success: true,
      total: students.length,
      processed: results.filter(r => r.success).length,
      results,
    });

  } catch (error) {
    return res.status(500).json({ error: 'Bulk provisioning failed', details: error.message });
  }
});

export default router;