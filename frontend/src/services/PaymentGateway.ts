/**
 * PaymentGateway Service - Client-side abstraction for payment gateway operations
 * 
 * This service communicates with the backend API to:
 * - Provision Dedicated Virtual Accounts (DVA) for students
 * - Check payment status
 * - Retrieve payment history
 * 
 * Webhooks are handled server-side only (see backend/routes/webhook.js)
 */

import { supabase } from './api/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const PaymentGateway = {
  /**
   * Provision a Dedicated Virtual Account for a student
   * @param {string} student_id - Student UUID
   * @param {string} school_id - School UUID
   */
  async provisionDVA(student_id: string, school_id: string) {
    const response = await fetch(`${API_BASE_URL}/dva/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ student_id, school_id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to provision DVA');
    }

    return response.json();
  },

  /**
   * Get DVA details for a student
   * @param {string} student_id - Student UUID
   * @param {string} school_id - School UUID
   */
  async getDVA(student_id: string, school_id: string) {
    const response = await fetch(`${API_BASE_URL}/dva/${student_id}?school_id=${school_id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'DVA not found');
    }

    return response.json();
  },

  /**
   * Get payment transaction history for a student
   * @param {string} student_id - Student UUID
   * @param {string} school_id - School UUID
   */
  async getPaymentHistory(student_id: string, school_id: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('student_id', student_id)
      .eq('school_id', school_id)
      .order('verified_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  },

  /**
   * Get payment status for a transaction reference
   * @param {string} reference - Transaction reference
   * @param {string} school_id - School UUID
   */
  async getPaymentStatus(reference: string, school_id: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('reference', reference)
      .eq('school_id', school_id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  /**
   * Compute settlement breakdown for a payment
   * This is calculated server-side during webhook processing
   * @param {string} student_id - Student UUID
   * @param {number} amount - Total payment amount
   */
  computeSettlementBreakdown(student_id: string, amount: number) {
    // Placeholder: Actual settlement split is configured on the gateway
    // and computed during webhook processing
    // 
    // Typical split:
    // - Tuition portion goes to School's settlement account
    // - Tech Levy (e.g., 1000) goes to Capstone
    // - Platform Fee (e.g., 200) goes to Capstone
    // 
    // The exact split percentages are configured per-school in payment_gateway_config
    return {
      tuition: amount - 1000 - 200, // Assuming standard fees
      tech_levy: 1000,
      platform_fee: 200,
      total: amount,
    };
  },
};

export default PaymentGateway;