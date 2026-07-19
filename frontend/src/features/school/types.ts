/**
 * CAPSTONE PHASE 2 - School Domain Types
 */

export type SchoolStatus = 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';
export type SchoolLevel = 'NURSERY' | 'PRIMARY' | 'SECONDARY' | 'NURSERY_PRIMARY' | 'PRIMARY_SECONDARY' | 'NURSERY_PRIMARY_SECONDARY';
export type GenderType = 'MIXED' | 'BOYS' | 'GIRLS';
export type ProfileRole = 'PROPRIETOR' | 'ADMIN';
export type AdminStatus = 'ACTIVE' | 'SUSPENDED';

export interface School {
  id: string;
  name: string;
  operational_status: SchoolStatus;
  school_level: SchoolLevel | null;
  gender_type: GenderType | null;
  owner_id: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  timezone: string;
  currency: string;
  website: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  current_session_id: string | null;
  current_term_id: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  phone: string | null;
  role: ProfileRole;
  admin_status: AdminStatus;
  created_at: string;
}

export interface AcademicSession {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: 'ACTIVE' | 'CLOSED';
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AcademicTerm {
  id: string;
  school_id: string;
  session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: 'ACTIVE' | 'CLOSED';
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingProgress {
  school_id: string;
  stage: number;
  completed_steps: string[];
  business_verified: boolean;
  settlement_verified: boolean;
  payment_service_ready: boolean;
  activated: boolean;
  created_at: string;
  updated_at: string;
}