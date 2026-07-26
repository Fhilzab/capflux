/**
 * Payment Domain Types
 */

export type GatewayProvider = 'PAYSTACK' | 'MONNIFY';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'ALLOCATED' | 'FAILED' | 'REVERSED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'POS' | 'ONLINE';
export type ReceiptStatus = 'ISSUED' | 'VOID';
export type DVAAccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Payment {
  id: string;
  studentId: string;
  billingProfileId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  gatewayProvider: GatewayProvider;
  providerReference: string;           // globally unique — idempotency key
  gatewayReference: string;
  gatewayMetadata?: Record<string, unknown>;  // raw gateway response for audit
  paymentDate: string;
  status: PaymentStatus;               // PENDING → CONFIRMED → ALLOCATED → FAILED | REVERSED
  createdAt: string;
  updatedAt: string;
}

/**
 * Reserved for future — separates gateway events from business payments.
 * A payer may initiate multiple attempts (wrong amount, retry, failed callback)
 * before one succeeds as a Payment.
 */
// export interface PaymentAttempt {
//   id: string;
//   paymentId: string;
//   gatewayProvider: GatewayProvider;
//   providerReference: string;
//   gatewayReference: string;
//   amount: number;
//   status: 'PENDING' | 'SUCCESS' | 'FAILED';
//   createdAt: string;
// }

export interface StudentPaymentAccount {
  id: string;
  schoolId: string;
  studentId: string;
  gatewayProvider: GatewayProvider;
  accountNumber: string;
  accountName: string;
  bankName: string;
  providerCustomerId: string;
  status: DVAAccountStatus;           // one ACTIVE per provider per student
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  studentChargeId: string;
  allocatedAmount: number;
  remainingAmount: number;             // payment.amount - sum(allocations so far)
  allocationOrder: number;             // 1, 2, 3... deterministic ordering
  createdAt: string;
}

export interface Receipt {
  id: string;
  paymentId: string;                   // Payment does NOT have receiptId
  receiptNumber: string;               // RCP-2026-1T-000041
  studentId: string;
  billingProfileId: string;
  totalAmount: number;
  currency: string;
  gatewayProvider: GatewayProvider;    // immutable copy from Payment
  paymentMethod: PaymentMethod;        // immutable copy from Payment
  issuedAt: string;
  status: ReceiptStatus;               // ISSUED | VOID — never deleted, numbers never reused
}

export interface PaymentResult<T> {
  data: T | null;
  error: PaymentError | null;
}

export type PaymentErrorCode =
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_CREATE_FAILED'
  | 'PAYMENT_UPDATE_FAILED'
  | 'PAYMENT_ALREADY_EXISTS'
  | 'PAYMENT_ALREADY_ALLOCATED'
  | 'ALLOCATION_FAILED'
  | 'ALLOCATION_ALREADY_EXISTS'
  | 'RECEIPT_CREATE_FAILED'
  | 'RECEIPT_ALREADY_EXISTS'
  | 'CHARGE_NOT_FOUND'
  | 'CHARGE_ALREADY_PAID'
  | 'CHARGE_LEDGER_LOCKED'
  | 'PROVIDER_VERIFICATION_FAILED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INVALID_PROVIDER_REFERENCE'
  | 'DUPLICATE_PROVIDER_REFERENCE'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface PaymentError {
  code: PaymentErrorCode;
  message: string;
  raw?: unknown;
}