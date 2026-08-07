/**
 * DVA Route - Dedicated Virtual Account provisioning
 * 
 * Endpoints:
 * - POST /api/dva/provision - Create payment account for a student
 * - GET /api/dva/:student_id - Get payment account details for a student
 * - POST /api/dva/deactivate - Deactivate a payment account
 */

import express from 'express';
import { supabase } from '../supabaseClient.js';
import { MonnifyGateway } from '../services/gateways/MonnifyGateway.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

// All DVA routes require an authenticated WorkOS session.
// DEPRECATED: prefer /api/payment-accounts for new integrations.
router.use(requireAuth);

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

    // Check if payment account already exists
    const { data: existingAccount } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('student_id', student_id)
      .eq('is_primary', true)
      .single();

    if (existingAccount) {
      return res.json({
        success: true,
        already_exists: true,
        payment_account: existingAccount,
      });
    }

    // Create DVA via gateway
    const studentName = `${student.first_name} ${student.last_name}`;
    const accountDetails = await monnifyGateway.createStudentPaymentAccount({
      student_id,
      student_name: studentName,
      guardian_phone: student.guardian_id, // Will be resolved via guardian lookup
      gateway_config: gatewayConfig,
      school_id,
    });

    // Save payment account to database (NOT to students table)
    const { data: paymentAccount, error: accountError } = await supabase
      .from('payment_accounts')
      .insert({
        school_id,
        student_id,
        provider: gatewayConfig.provider,
        provider_account_id: accountDetails.provider_account_id,
        provider_reference: accountDetails.provider_reference,
        virtual_account_number: accountDetails.virtual_account_number,
        account_name: accountDetails.account_name,
        bank_name: accountDetails.bank_name,
        account_status: 'ACTIVE',
        is_primary: true,
      })
      .select()
      .single();

    if (accountError) {
      return res.status(500).json({ error: `Failed to save payment account: ${accountError.message}` });
    }

    return res.json({
      success: true,
      payment_account: paymentAccount,
    });

  } catch (error) {
    console.error('Payment account provisioning error:', error);
    return res.status(500).json({ error: 'Failed to provision payment account', details: error.message });
  }
});

// GET /api/dva/:student_id
// Get payment account details for a student
router.get('/:student_id', async (req, res) => {
  const { student_id } = req.params;
  const { school_id } = req.query;

  if (!school_id) {
    return res.status(400).json({ error: 'school_id query parameter required' });
  }

  try {
    const { data: account, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('student_id', student_id)
      .eq('school_id', school_id)
      .eq('is_primary', true)
      .single();

    if (error || !account) {
      return res.status(404).json({ error: 'Payment account not found for student' });
    }

    return res.json({ success: true, payment_account: account });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch payment account', details: error.message });
  }
});

// POST /api/dva/deactivate
// Deactivate a payment account
router.post('/deactivate', async (req, res) => {
  const { account_id, school_id } = req.body;

  if (!account_id || !school_id) {
    return res.status(400).json({ error: 'account_id and school_id are required' });
  }

  try {
    // Get gateway config for school
    const { data: gatewayConfig, error: configError } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !gatewayConfig) {
      return res.status(404).json({ error: 'No active payment gateway configured' });
    }

    // Get the payment account
    const { data: account, error: accountError } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    // Deactivate via gateway
    await monnifyGateway.deactivatePaymentAccount({
      virtual_account_number: account.virtual_account_number,
      gateway_config: gatewayConfig,
    });

    // Update the payment account status
    const { data: updatedAccount, error: updateError } = await supabase
      .from('payment_accounts')
      .update({
        account_status: 'INACTIVE',
        is_primary: false,
        deactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', account_id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: `Failed to deactivate payment account: ${updateError.message}` });
    }

    return res.json({
      success: true,
      payment_account: updatedAccount,
    });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to deactivate payment account', details: error.message });
  }
});

// POST /api/dva/bulk-provision
// Provision payment accounts for multiple students
router.post('/bulk-provision', async (req, res) => {
  const { school_id } = req.body;

  if (!school_id) {
    return res.status(400).json({ error: 'school_id is required' });
  }

  try {
    // Get all active students without payment account
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', school_id)
      .eq('status', 'ACTIVE');

    if (studentsError) {
      return res.status(500).json({ error: studentsError.message });
    }

    // Filter students who don't have a primary payment account
    const studentsWithoutAccount = [];
    for (const student of students) {
      const { data: existing } = await supabase
        .from('payment_accounts')
        .select('id')
        .eq('student_id', student.id)
        .eq('is_primary', true)
        .single();
      if (!existing) {
        studentsWithoutAccount.push(student);
      }
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

    for (const student of studentsWithoutAccount) {
      try {
        const studentName = `${student.first_name} ${student.last_name}`;
        const accountDetails = await monnifyGateway.createStudentPaymentAccount({
          student_id: student.id,
          student_name: studentName,
          guardian_phone: student.guardian_id,
          gateway_config: gatewayConfig,
          school_id,
        });

        const { data: account } = await supabase
          .from('payment_accounts')
          .insert({
            school_id,
            student_id: student.id,
            provider: gatewayConfig.provider,
            provider_account_id: accountDetails.provider_account_id,
            provider_reference: accountDetails.provider_reference,
            virtual_account_number: accountDetails.virtual_account_number,
            account_name: accountDetails.account_name,
            bank_name: accountDetails.bank_name,
            account_status: 'ACTIVE',
            is_primary: true,
          })
          .select()
          .single();

        results.push({ student_id: student.id, success: true, account });
      } catch (err) {
        results.push({ student_id: student.id, success: false, error: err.message });
      }
    }

    return res.json({
      success: true,
      total: studentsWithoutAccount.length,
      processed: results.filter(r => r.success).length,
      results,
    });

  } catch (error) {
    return res.status(500).json({ error: 'Bulk provisioning failed', details: error.message });
  }
});

export default router;