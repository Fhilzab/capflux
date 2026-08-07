/**
 * Payment Accounts Route - Provider-agnostic payment account management
 * 
 * This route abstracts payment account operations across all providers.
 * Endpoints:
 * - POST /api/payment-accounts/provision - Create payment account for a student
 * - GET /api/payment-accounts/:student_id - Get payment account details for a student
 * - POST /api/payment-accounts/deactivate - Deactivate a payment account
 * - POST /api/payment-accounts/bulk-provision - Provision accounts for multiple students
 */

import express from 'express';
import { supabase } from '../supabaseClient.js';
import { GatewayFactory } from '../services/gateways/GatewayFactory.js';
import requireAuth from '../middleware/requireAuth.js';
import requirePaymentReady from '../middleware/requirePaymentReady.js';

const router = express.Router();

// All payment-account routes require an authenticated WorkOS session.
router.use(requireAuth);

// Payment-mutating routes also require payment readiness (ACTIVE + READY).
router.post('/provision', requirePaymentReady, async (req, res) => {
  const { student_id, school_id } = req.body;

  if (!student_id || !school_id) {
    return res.status(400).json({ error: 'student_id and school_id are required' });
  }

  try {
    // Authorization: only users with payment.record can provision
    // (identity is derived from the authenticated session, not headers).
    const userId = req.user.id;
    const { AuthorizationService } = await import('../services/AuthorizationService.js');
    const authz = new AuthorizationService();
    try {
      await authz.assertPermission(userId, school_id, 'payments.receive');
    } catch (permErr) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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

    // Get gateway config for school (provider-agnostic)
    const { data: gatewayConfig, error: configError } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !gatewayConfig) {
      return res.status(404).json({ error: 'No active payment gateway configured for school' });
    }

    // Get gateway instance from factory
    const gateway = GatewayFactory.get(gatewayConfig.provider);
    if (!gateway) {
      return res.status(400).json({ error: `Unsupported provider: ${gatewayConfig.provider}` });
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

    // Create payment account via gateway
    const studentName = `${student.first_name} ${student.last_name}`;
    const accountDetails = await gateway.createStudentPaymentAccount({
      student_id,
      student_name: studentName,
      guardian_phone: student.guardian_id,
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

// GET /api/payment-accounts/:student_id
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

// POST /api/payment-accounts/deactivate
// Deactivate a payment account
router.post('/deactivate', requirePaymentReady, async (req, res) => {
  const { account_id, school_id } = req.body;

  if (!account_id || !school_id) {
    return res.status(400).json({ error: 'account_id and school_id are required' });
  }

  try {
    // Get payment account
    const { data: account, error: accountError } = await supabase
      .from('payment_accounts')
      .select('*, payment_gateway_config!inner(provider, api_key, secret_key, submerchant_code)')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    // Get gateway instance from factory
    const gateway = GatewayFactory.get(account.provider);
    if (gateway && gateway.deactivatePaymentAccount) {
      await gateway.deactivatePaymentAccount({
        virtual_account_number: account.virtual_account_number,
        gateway_config: {
          api_key: account.payment_gateway_config.api_key,
          secret_key: account.payment_gateway_config.secret_key,
          provider: account.provider,
        },
      });
    }

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

// POST /api/payment-accounts/bulk-provision
// Provision payment accounts for multiple students
router.post('/bulk-provision', requirePaymentReady, async (req, res) => {
  const { school_id } = req.body;

  if (!school_id) {
    return res.status(400).json({ error: 'school_id is required' });
  }

  try {
    // Get all active students
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

    // Get gateway instance from factory
    const gateway = GatewayFactory.get(gatewayConfig.provider);
    if (!gateway) {
      return res.status(400).json({ error: `Unsupported provider: ${gatewayConfig.provider}` });
    }

    const results = [];

    for (const student of studentsWithoutAccount) {
      try {
        const studentName = `${student.first_name} ${student.last_name}`;
        const accountDetails = await gateway.createStudentPaymentAccount({
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