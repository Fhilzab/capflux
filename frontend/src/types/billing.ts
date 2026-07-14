// ============================================================================
// Capstone School ERP - TypeScript Interfaces
// Strict typing for Fee-First Billing Architecture
// No 'any' or 'ts-ignore' - production ready
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export type StudentCategory = 'NURSERY' | 'PRIMARY' | 'SECONDARY';
export type AcademicTerm = 'FIRST' | 'SECOND' | 'THIRD';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface School {
  id: string;
  name: string;
  subscription_status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
}

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  role: 'PROPRIETOR' | 'ADMIN' | 'BURSAR';
  created_at: string;
}

// ============================================================================
// GUARDIAN
// ============================================================================

export interface Guardian {
  id: string;
  school_id: string;
  full_name: string;
  primary_phone: string;
  secondary_phone?: string;
  email?: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// STUDENT
// ============================================================================

export interface Student {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  category: StudentCategory;
  guardian_id?: string;
  status: 'ACTIVE' | 'GRADUATED' | 'LEFT';
  client_sequence: number;
  device_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TUITION CONFIGURATION
// Configured per (school, session, term, category)
// ============================================================================

export interface TuitionConfiguration {
  id: string;
  school_id: string;
  academic_session: string; // e.g., '2025/2026'
  academic_term: AcademicTerm;
  category: StudentCategory;
  tuition_amount: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// FEE RULES
// Configurable platform & banking service fee policy
// ============================================================================

export interface FeeRule {
  id: string;
  school_id: string;
  minimum_fee: number;
  percentage: number; // Percentage of payment (e.g., 1.50 = 1.5%)
  maximum_fee: number;
  effective_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformFeeCalculation {
  fee: number;
  breakdown: {
    base_amount: number;
    percentage: number;
    calculated_fee: number;
    minimum_applied: boolean;
    maximum_applied: boolean;
  };
}

// ============================================================================
// PAYMENT ACCOUNTS (DEDICATED VIRTUAL ACCOUNTS)
// Provider-agnostic payment account domain
// ==========================================================

export interface PaymentAccount {
  id: string;
  school_id: string;
  student_id: string;
  provider: 'monnify' | 'flutterwave' | 'remita';
  provider_account_id?: string;
  provider_reference?: string;
  virtual_account_number: string;
  account_name: string;
  bank_name: string;
  account_status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deactivated_at?: string;
  // Legacy compatibility fields
  dva_account_number?: string;
  dva_bank_name?: string;
  dva_account_name?: string;
  provider_ref?: string;
  account_number?: string;
}

// Request to create a payment account
export interface PaymentAccountRequest {
  school_id: string;
  student_id: string;
  provider: 'monnify' | 'flutterwave' | 'remita';
  provider_account_id?: string;
  provider_reference?: string;
  virtual_account_number: string;
  account_name: string;
  bank_name: string;
  account_status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

// ============================================================================
// LEDGER ENTRIES
// Append-only immutable financial records
// ============================================================================

export type LedgerEntryType = 'DEBIT' | 'CREDIT';
export type LedgerEntryCategory = 
  | 'TUITION' 
  | 'PLATFORM_BANKING_FEE'
  | 'TECH_LEVY' 
  | 'BOOKS' 
  | 'UNIFORM' 
  | 'TRANSPORT' 
  | 'EXAM' 
  | 'OTHER'
  | 'DISCOUNT' 
  | 'REFUND' 
  | 'ADJUSTMENT';

export interface LedgerEntry {
  id: string;
  school_id: string;
  student_id: string;
  amount: number;
  entry_type: LedgerEntryType;
  entry_category: LedgerEntryCategory;
  entry_description?: string;
  reference_id?: string;
  metadata: Record<string, unknown>;
  client_sequence: number;
  device_id: string;
  created_at: string;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  school_id: string;
  student_id: string;
  guardian_id?: string;
  recipient_phone: string;
  recipient_email?: string;
  message_body: string;
  delivery_status: 'PENDING' | 'SENT' | 'FAILED';
  delivery_method?: string;
  client_sequence: number;
  device_id: string;
  created_at: string;
}

// ============================================================================
// SYNC QUEUE
// ============================================================================

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';

export interface SyncQueueItem {
  id: string;
  school_id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  status: SyncStatus;
  retry_count: number;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

// ============================================================================
// PAYMENT GATEWAY CONFIGURATION
// ============================================================================

export interface PaymentGatewayConfig {
  id: string;
  school_id: string;
  provider: 'monnify' | 'flutterwave' | 'remita';
  api_key: string;
  secret_key: string;
  submerchant_code?: string;
  settlement_account_number: string;
  settlement_account_bank: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// PAYMENT TRANSACTIONS
// ============================================================================

export interface PaymentTransaction {
  id: string;
  school_id: string;
  student_id: string;
  gateway_txn_ref: string;
  reference: string;
  amount: number;
  settlement_status: 'PENDING' | 'SUCCESS' | 'FAILED';
  verified_at: string;
}

// ============================================================================
// STUDENT REGISTRATION REQUEST
// ============================================================================

export interface StudentRegistrationRequest {
  school_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  category: StudentCategory;
  academic_session: string;
  academic_term: AcademicTerm;
  guardian_full_name: string;
  guardian_phone: string;
  guardian_secondary_phone?: string;
  guardian_email?: string;
  relationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
}

// ============================================================================
// PAYMENT PROVIDER INTERFACE
// ============================================================================

export interface DVARequest {
  school_id: string;
  student_id: string;
  student_name: string;
  guardian_phone: string;
  gateway_config: PaymentGatewayConfig;
}

export interface DVAResponse {
  dva_account_number: string;
  dva_bank_name: string;
  dva_account_name: string;
  provider: string;
  provider_ref?: string;
  // New fields for compatibility with PaymentAccount
  provider_account_id?: string;
  provider_reference?: string;
  virtual_account_number?: string;
  account_name?: string;
  bank_name?: string;
}

export interface TransactionVerification {
  school_id: string;
  student_id: string;
  amount: number;
  reference: string;
  gateway_txn_ref: string;
  transaction: Record<string, unknown>;
  alreadyProcessed: boolean;
}