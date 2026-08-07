/**
 * PaymentGateway Service - Client-side abstraction for payment gateway operations
 *
 * This service communicates with the backend API to:
 * - Provision Dedicated Virtual Accounts (DVA) for students
 * - Check payment status
 * - Retrieve payment history
 *
 * Uses the canonical /api/payment-accounts/* endpoints. The deprecated
 * /api/dva/* routes are no longer called from new frontend code.
 * Authentication is carried by the HttpOnly session cookie.
 *
 * Webhooks are handled server-side only (see backend/routes/webhook.js)
 */

import type { PaymentAccount, DVAResponse } from '../types/billing';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const PaymentGateway = {
  /**
   * Provision a Dedicated Virtual Account for a student
   * @param {string} student_id - Student UUID
   * @param {string} school_id - School UUID
   */
  async provisionDVA(student_id: string, school_id: string): Promise<{
    dva?: DVAResponse;
    payment_account?: PaymentAccount;
  }> {
    const response = await fetch(`${API_BASE_URL}/payment-accounts/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
  async getDVA(student_id: string, school_id: string): Promise<{
    dva?: PaymentAccount | DVAResponse;
    payment_account?: PaymentAccount;
    success?: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/payment-accounts/${student_id}?school_id=${school_id}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'DVA not found');
    }

    return response.json();
  },

  /**
   * Get payment transaction history for a student (async using IndexedDB)
   */
  async getPaymentHistory(student_id: string, _school_id: string): Promise<unknown[]> {
    // Use local DB instead of supabase for offline-first
    const { default: db } = await import('../../offline/localDb');
    return db.payment_transactions.where('student_id').equals(student_id).toArray();
  },

  /**
   * Get payment status for a transaction reference (async using IndexedDB)
   */
  async getPaymentStatus(reference: string, _school_id: string): Promise<unknown | null> {
    const { default: db } = await import('../../offline/localDb');
    return db.payment_transactions.where('reference').equals(reference).first() || null;
  },

  /**
   * Deactivate a payment account
   */
  async deactivatePaymentAccount(account_id: string, school_id: string) {
    const response = await fetch(`${API_BASE_URL}/payment-accounts/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ account_id, school_id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to deactivate payment account');
    }

    return response.json();
  },
};

export default PaymentGateway;