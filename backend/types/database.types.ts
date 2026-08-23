/**
 * database.types.ts — AUTO-GENERATED Supabase database types.
 *
 * GENERATED FROM THE LIVE PROJECT SCHEMA (public). DO NOT EDIT BY HAND.
 *
 * Regenerate whenever the database schema changes:
 *   cd backend && SUPABASE_ACCESS_TOKEN=<personal-access-token> npm run db:types
 *
 * Domain code should consume these through the derived aliases in
 * types/db.ts rather than importing raw Database paths everywhere.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          currency: string
          school_id: string
          settings: Json
          timezone: string
        }
        Insert: {
          currency?: string
          school_id: string
          settings?: Json
          timezone?: string
        }
        Update: {
          currency?: string
          school_id?: string
          settings?: Json
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          metadata: Json
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          metadata?: Json
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          metadata?: Json
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      dva_assignments: {
        Row: {
          created_at: string
          dva_account_name: string
          dva_account_number: string
          dva_bank_name: string
          id: string
          is_active: boolean
          provider: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dva_account_name: string
          dva_account_number: string
          dva_bank_name: string
          id?: string
          is_active?: boolean
          provider: string
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dva_account_name?: string
          dva_account_number?: string
          dva_bank_name?: string
          id?: string
          is_active?: boolean
          provider?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dva_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dva_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "dva_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_rules: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          is_active: boolean
          maximum_fee: number
          minimum_fee: number
          percentage: number
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          maximum_fee?: number
          minimum_fee?: number
          percentage?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          maximum_fee?: number
          minimum_fee?: number
          percentage?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          notes: string | null
          provider: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          provider: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          provider?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          primary_phone: string
          relationship: Database["public"]["Enums"]["guardian_relationship"]
          school_id: string
          secondary_phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          primary_phone: string
          relationship?: Database["public"]["Enums"]["guardian_relationship"]
          school_id: string
          secondary_phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          primary_phone?: string
          relationship?: Database["public"]["Enums"]["guardian_relationship"]
          school_id?: string
          secondary_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_records: {
        Row: {
          bvn_encrypted: string | null
          bvn_last4: string | null
          bvn_verification_status:
            | Database["public"]["Enums"]["kyc_status"]
            | null
          cac_certificate_path: string | null
          cac_document_checksum: string | null
          cac_document_file_size: number | null
          cac_document_mime_type: string | null
          cac_document_path: string | null
          cac_document_status: Database["public"]["Enums"]["kyc_status"] | null
          cac_document_uploaded_at: string | null
          cac_registration_number: string | null
          cac_verified_at: string | null
          cac_verified_by: string | null
          created_at: string
          id: string
          identity_document_type: string | null
          identity_match_states: Json | null
          identity_verified_at: string | null
          identity_verified_by: string | null
          nin_encrypted: string | null
          nin_last4: string | null
          nin_verification_status:
            | Database["public"]["Enums"]["kyc_status"]
            | null
          official_email: string | null
          official_phone: string | null
          principal_name: string | null
          principal_phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          updated_at: string
          verification_provider: string | null
          verification_reference: string | null
          verified_at: string | null
        }
        Insert: {
          bvn_encrypted?: string | null
          bvn_last4?: string | null
          bvn_verification_status?:
            | Database["public"]["Enums"]["kyc_status"]
            | null
          cac_certificate_path?: string | null
          cac_document_checksum?: string | null
          cac_document_file_size?: number | null
          cac_document_mime_type?: string | null
          cac_document_path?: string | null
          cac_document_status?: Database["public"]["Enums"]["kyc_status"] | null
          cac_document_uploaded_at?: string | null
          cac_registration_number?: string | null
          cac_verified_at?: string | null
          cac_verified_by?: string | null
          created_at?: string
          id?: string
          identity_document_type?: string | null
          identity_match_states?: Json | null
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          nin_encrypted?: string | null
          nin_last4?: string | null
          nin_verification_status?:
            | Database["public"]["Enums"]["kyc_status"]
            | null
          official_email?: string | null
          official_phone?: string | null
          principal_name?: string | null
          principal_phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          verification_provider?: string | null
          verification_reference?: string | null
          verified_at?: string | null
        }
        Update: {
          bvn_encrypted?: string | null
          bvn_last4?: string | null
          bvn_verification_status?:
            | Database["public"]["Enums"]["kyc_status"]
            | null
          cac_certificate_path?: string | null
          cac_document_checksum?: string | null
          cac_document_file_size?: number | null
          cac_document_mime_type?: string | null
          cac_document_path?: string | null
          cac_document_status?: Database["public"]["Enums"]["kyc_status"] | null
          cac_document_uploaded_at?: string | null
          cac_registration_number?: string | null
          cac_verified_at?: string | null
          cac_verified_by?: string | null
          created_at?: string
          id?: string
          identity_document_type?: string | null
          identity_match_states?: Json | null
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          nin_encrypted?: string | null
          nin_last4?: string | null
          nin_verification_status?:
            | Database["public"]["Enums"]["kyc_status"]
            | null
          official_email?: string | null
          official_phone?: string | null
          principal_name?: string | null
          principal_phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          verification_provider?: string | null
          verification_reference?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_records_cac_verified_by_fkey"
            columns: ["cac_verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_records_identity_verified_by_fkey"
            columns: ["identity_verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_records_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          comparison: Json | null
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          kyc_record_id: string
          provider: string | null
          provider_reference: string | null
          raw_response: Json
          school_id: string
          status: string
          verification_type: string
          verified_at: string | null
          verified_by: string | null
          verified_fields: Json | null
        }
        Insert: {
          comparison?: Json | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          kyc_record_id: string
          provider?: string | null
          provider_reference?: string | null
          raw_response?: Json
          school_id: string
          status: string
          verification_type: string
          verified_at?: string | null
          verified_by?: string | null
          verified_fields?: Json | null
        }
        Update: {
          comparison?: Json | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          kyc_record_id?: string
          provider?: string | null
          provider_reference?: string | null
          raw_response?: Json
          school_id?: string
          status?: string
          verification_type?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_fields?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verifications_kyc_record_id_fkey"
            columns: ["kyc_record_id"]
            isOneToOne: false
            referencedRelation: "kyc_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          client_sequence: number
          created_at: string
          device_id: string
          entry_category: Database["public"]["Enums"]["ledger_entry_category"]
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          idempotency_key: string | null
          metadata: Json
          reference_id: string | null
          school_id: string
          source_document_id: string | null
          source_document_type: string | null
          student_id: string
        }
        Insert: {
          amount: number
          client_sequence: number
          created_at?: string
          device_id: string
          entry_category: Database["public"]["Enums"]["ledger_entry_category"]
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reference_id?: string | null
          school_id: string
          source_document_id?: string | null
          source_document_type?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          client_sequence?: number
          created_at?: string
          device_id?: string
          entry_category?: Database["public"]["Enums"]["ledger_entry_category"]
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reference_id?: string | null
          school_id?: string
          source_document_id?: string | null
          source_document_type?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "ledger_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_identity_migrations: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          legacy_user_id: string | null
          status: string
          workos_user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          legacy_user_id?: string | null
          status?: string
          workos_user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          legacy_user_id?: string | null
          status?: string
          workos_user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          client_sequence: number
          created_at: string
          delivery_status: Database["public"]["Enums"]["notification_status"]
          device_id: string
          guardian_id: string | null
          id: string
          message_body: string
          provider_msg_id: string | null
          recipient_phone: string
          school_id: string
          student_id: string | null
        }
        Insert: {
          client_sequence?: number
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_status"]
          device_id?: string
          guardian_id?: string | null
          id?: string
          message_body: string
          provider_msg_id?: string | null
          recipient_phone: string
          school_id: string
          student_id?: string | null
        }
        Update: {
          client_sequence?: number
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["notification_status"]
          device_id?: string
          guardian_id?: string | null
          id?: string
          message_body?: string
          provider_msg_id?: string | null
          recipient_phone?: string
          school_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          activated: boolean
          activated_at: string | null
          business_verified: boolean
          completed_at: string | null
          completed_steps: Json
          created_at: string
          organization_completed: boolean
          owner_completed: boolean
          payment_service_ready: boolean
          profile_completed: boolean
          school_completed: boolean
          school_id: string
          settlement_verified: boolean
          stage: number
          updated_at: string
        }
        Insert: {
          activated?: boolean
          activated_at?: string | null
          business_verified?: boolean
          completed_at?: string | null
          completed_steps?: Json
          created_at?: string
          organization_completed?: boolean
          owner_completed?: boolean
          payment_service_ready?: boolean
          profile_completed?: boolean
          school_completed?: boolean
          school_id: string
          settlement_verified?: boolean
          stage?: number
          updated_at?: string
        }
        Update: {
          activated?: boolean
          activated_at?: string | null
          business_verified?: boolean
          completed_at?: string | null
          completed_steps?: Json
          created_at?: string
          organization_completed?: boolean
          owner_completed?: boolean
          payment_service_ready?: boolean
          profile_completed?: boolean
          school_completed?: boolean
          school_id?: string
          settlement_verified?: boolean
          stage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          is_active: boolean
          joined_at: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          joined_at?: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          joined_at?: string
          organization_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          account_reference: string
          account_status: string
          bank_name: string
          created_at: string
          deactivated_at: string | null
          id: string
          idempotency_key: string | null
          is_primary: boolean
          provider: string | null
          provider_account_id: string | null
          provider_event_ref: string | null
          provider_name: string
          provider_reference: string | null
          provider_student_reference: string | null
          provisioning_error: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
          virtual_account_number: string | null
        }
        Insert: {
          account_name?: string | null
          account_number: string
          account_reference: string
          account_status?: string
          bank_name: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_primary?: boolean
          provider?: string | null
          provider_account_id?: string | null
          provider_event_ref?: string | null
          provider_name: string
          provider_reference?: string | null
          provider_student_reference?: string | null
          provisioning_error?: string | null
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
          virtual_account_number?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string
          account_reference?: string
          account_status?: string
          bank_name?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_primary?: boolean
          provider?: string | null
          provider_account_id?: string | null
          provider_event_ref?: string | null
          provider_name?: string
          provider_reference?: string | null
          provider_student_reference?: string | null
          provisioning_error?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
          virtual_account_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payment_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_config: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          is_active: boolean
          provider: string
          school_id: string
          secret_key: string | null
          settlement_account_bank: string
          settlement_account_number: string
          submerchant_code: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider: string
          school_id: string
          secret_key?: string | null
          settlement_account_bank: string
          settlement_account_number: string
          submerchant_code?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          school_id?: string
          secret_key?: string | null
          settlement_account_bank?: string
          settlement_account_number?: string
          submerchant_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          amount_minor: number
          currency: string
          entry_category: string
          failure_reason: string | null
          gateway_txn_ref: string
          id: string
          idempotency_key: string | null
          payment_method: string | null
          provider_event_id: string | null
          raw_payload: Json
          reference: string
          reversed_at: string | null
          reversed_by: string | null
          school_id: string
          settlement_status: string
          status: Database["public"]["Enums"]["payment_txn_status"]
          student_id: string
          verified_at: string
        }
        Insert: {
          amount: number
          amount_minor?: number
          currency?: string
          entry_category: string
          failure_reason?: string | null
          gateway_txn_ref: string
          id?: string
          idempotency_key?: string | null
          payment_method?: string | null
          provider_event_id?: string | null
          raw_payload?: Json
          reference: string
          reversed_at?: string | null
          reversed_by?: string | null
          school_id: string
          settlement_status: string
          status?: Database["public"]["Enums"]["payment_txn_status"]
          student_id: string
          verified_at?: string
        }
        Update: {
          amount?: number
          amount_minor?: number
          currency?: string
          entry_category?: string
          failure_reason?: string | null
          gateway_txn_ref?: string
          id?: string
          idempotency_key?: string | null
          payment_method?: string | null
          provider_event_id?: string | null
          raw_payload?: Json
          reference?: string
          reversed_at?: string | null
          reversed_by?: string | null
          school_id?: string
          settlement_status?: string
          status?: Database["public"]["Enums"]["payment_txn_status"]
          student_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "payment_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          resource: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          resource: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          resource?: string
        }
        Relationships: []
      }
      principal_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          school_id: string
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role?: string
          school_id: string
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          school_id?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "principal_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_status: Database["public"]["Enums"]["admin_status"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
          school_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_status?: Database["public"]["Enums"]["admin_status"]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_status?: Database["public"]["Enums"]["admin_status"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_issues: {
        Row: {
          amount_minor: number | null
          created_at: string
          details: Json
          id: string
          issue_type: string
          reconciliation_run_id: string
          reference: string | null
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          status: string
        }
        Insert: {
          amount_minor?: number | null
          created_at?: string
          details?: Json
          id?: string
          issue_type: string
          reconciliation_run_id: string
          reference?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          status?: string
        }
        Update: {
          amount_minor?: number | null
          created_at?: string
          details?: Json
          id?: string
          issue_type?: string
          reconciliation_run_id?: string
          reference?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_issues_reconciliation_run_id_fkey"
            columns: ["reconciliation_run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_issues_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          completed_at: string | null
          end_date: string
          id: string
          provider: string
          school_id: string
          start_date: string
          started_at: string
          started_by: string | null
          status: string
          summary: Json
        }
        Insert: {
          completed_at?: string | null
          end_date: string
          id?: string
          provider: string
          school_id: string
          start_date: string
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: Json
        }
        Update: {
          completed_at?: string | null
          end_date?: string
          id?: string
          provider?: string
          school_id?: string
          start_date?: string
          started_at?: string
          started_by?: string | null
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_runs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system_role: boolean | null
          name: string
          organization_id: string | null
          system_role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          organization_id?: string | null
          system_role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          organization_id?: string | null
          system_role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          id: string
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          role_id: string
          school_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          role_id: string
          school_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          role_id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      school_shareholders: {
        Row: {
          created_at: string
          date_of_birth_encrypted: string | null
          encrypted_identity_document: string | null
          full_name: string
          id: string
          identity_document_type: string | null
          identity_match_status: string | null
          identity_nin_last4: string | null
          identity_type: string
          ownership_percentage: number
          phone: string
          role: string
          school_id: string
          updated_at: string
          verification_reference: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth_encrypted?: string | null
          encrypted_identity_document?: string | null
          full_name: string
          id?: string
          identity_document_type?: string | null
          identity_match_status?: string | null
          identity_nin_last4?: string | null
          identity_type: string
          ownership_percentage: number
          phone: string
          role: string
          school_id: string
          updated_at?: string
          verification_reference?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth_encrypted?: string | null
          encrypted_identity_document?: string | null
          full_name?: string
          id?: string
          identity_document_type?: string | null
          identity_match_status?: string | null
          identity_nin_last4?: string | null
          identity_type?: string
          ownership_percentage?: number
          phone?: string
          role?: string
          school_id?: string
          updated_at?: string
          verification_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_shareholders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          academic_calendar: Json
          address: string | null
          business_type: string | null
          cac_number: string | null
          country: string
          created_at: string
          gender: string | null
          id: string
          lga: string | null
          name: string
          organization_id: string | null
          owner_id: string | null
          owner_user_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          school_category: string | null
          school_levels: string[] | null
          school_type: string | null
          settlement_account_name: string | null
          settlement_account_number: string | null
          settlement_bank: string | null
          settlement_verified: boolean | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["school_status"]
          tax_identification_number: string | null
          updated_at: string
        }
        Insert: {
          academic_calendar?: Json
          address?: string | null
          business_type?: string | null
          cac_number?: string | null
          country?: string
          created_at?: string
          gender?: string | null
          id?: string
          lga?: string | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          owner_user_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          school_category?: string | null
          school_levels?: string[] | null
          school_type?: string | null
          settlement_account_name?: string | null
          settlement_account_number?: string | null
          settlement_bank?: string | null
          settlement_verified?: boolean | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          tax_identification_number?: string | null
          updated_at?: string
        }
        Update: {
          academic_calendar?: Json
          address?: string | null
          business_type?: string | null
          cac_number?: string | null
          country?: string
          created_at?: string
          gender?: string | null
          id?: string
          lga?: string | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          owner_user_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          school_category?: string | null
          school_levels?: string[] | null
          school_type?: string | null
          settlement_account_name?: string | null
          settlement_account_number?: string | null
          settlement_bank?: string | null
          settlement_verified?: boolean | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          tax_identification_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_account_verifications: {
        Row: {
          account_name_returned: string | null
          account_number_last4: string
          comparison: Json | null
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          provider: string
          provider_reference: string | null
          raw_response: Json
          school_id: string
          settlement_account_id: string
          status: string
          verified_at: string
          verified_fields: Json | null
        }
        Insert: {
          account_name_returned?: string | null
          account_number_last4: string
          comparison?: Json | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          provider: string
          provider_reference?: string | null
          raw_response?: Json
          school_id: string
          settlement_account_id: string
          status: string
          verified_at?: string
          verified_fields?: Json | null
        }
        Update: {
          account_name_returned?: string | null
          account_number_last4?: string
          comparison?: Json | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          provider?: string
          provider_reference?: string | null
          raw_response?: Json
          school_id?: string
          settlement_account_id?: string
          status?: string
          verified_at?: string
          verified_fields?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_account_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_account_verifications_settlement_account_id_fkey"
            columns: ["settlement_account_id"]
            isOneToOne: false
            referencedRelation: "settlement_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          account_verification_reference: string | null
          bank_code: string
          bank_name: string | null
          bvn_encrypted: string | null
          bvn_last4: string | null
          created_at: string
          id: string
          ownership_match_status: string | null
          rejection_reason: string | null
          school_id: string
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_name?: string | null
          account_number: string
          account_verification_reference?: string | null
          bank_code: string
          bank_name?: string | null
          bvn_encrypted?: string | null
          bvn_last4?: string | null
          created_at?: string
          id?: string
          ownership_match_status?: string | null
          rejection_reason?: string | null
          school_id: string
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string
          account_verification_reference?: string | null
          bank_code?: string
          bank_name?: string | null
          bvn_encrypted?: string | null
          bvn_last4?: string | null
          created_at?: string
          id?: string
          ownership_match_status?: string | null
          rejection_reason?: string | null
          school_id?: string
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_accounts_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_accounts_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_records: {
        Row: {
          account_number: string
          amount: number
          bank_name: string
          destination: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          payment_transaction_id: string
          raw_response: Json
          settled_at: string
          settlement_account_id: string | null
          status: string
        }
        Insert: {
          account_number: string
          amount: number
          bank_name: string
          destination: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          payment_transaction_id: string
          raw_response?: Json
          settled_at?: string
          settlement_account_id?: string | null
          status?: string
        }
        Update: {
          account_number?: string
          amount?: number
          bank_name?: string
          destination?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          payment_transaction_id?: string
          raw_response?: Json
          settled_at?: string
          settlement_account_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_records_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_records_settlement_account_id_fkey"
            columns: ["settlement_account_id"]
            isOneToOne: false
            referencedRelation: "settlement_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          category: Database["public"]["Enums"]["student_category"]
          class_name: string
          client_sequence: number
          created_at: string
          device_id: string
          first_name: string
          guardian_id: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          school_id: string
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["student_category"]
          class_name: string
          client_sequence?: number
          created_at?: string
          device_id?: string
          first_name: string
          guardian_id?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          school_id: string
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["student_category"]
          class_name?: string
          client_sequence?: number
          created_at?: string
          device_id?: string
          first_name?: string
          guardian_id?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          school_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          operation: string
          payload: Json
          processed_at: string | null
          retry_count: number
          school_id: string
          status: Database["public"]["Enums"]["sync_status"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          operation: string
          payload: Json
          processed_at?: string | null
          retry_count?: number
          school_id: string
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          operation?: string
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          school_id?: string
          status?: Database["public"]["Enums"]["sync_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_configuration: {
        Row: {
          academic_session: string
          academic_term: Database["public"]["Enums"]["academic_term"]
          category: Database["public"]["Enums"]["student_category"]
          created_at: string
          id: string
          school_id: string
          tuition_amount: number
          updated_at: string
        }
        Insert: {
          academic_session: string
          academic_term: Database["public"]["Enums"]["academic_term"]
          category: Database["public"]["Enums"]["student_category"]
          created_at?: string
          id?: string
          school_id: string
          tuition_amount: number
          updated_at?: string
        }
        Update: {
          academic_session?: string
          academic_term?: Database["public"]["Enums"]["academic_term"]
          category?: Database["public"]["Enums"]["student_category"]
          created_at?: string
          id?: string
          school_id?: string
          tuition_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_configuration_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          full_name: string | null
          last_name: string | null
          lga_of_origin: string | null
          middle_name: string | null
          phone: string | null
          residential_address: string | null
          state_of_origin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string | null
          last_name?: string | null
          lga_of_origin?: string | null
          middle_name?: string | null
          phone?: string | null
          residential_address?: string | null
          state_of_origin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string | null
          last_name?: string | null
          lga_of_origin?: string | null
          middle_name?: string | null
          phone?: string | null
          residential_address?: string | null
          state_of_origin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: string
          created_at: string
          email: string
          email_verified: boolean
          id: string
          updated_at: string
        }
        Insert: {
          auth_provider?: string
          created_at?: string
          email: string
          email_verified?: boolean
          id: string
          updated_at?: string
        }
        Update: {
          auth_provider?: string
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      pending_notifications: {
        Row: {
          created_at: string | null
          delivery_status:
            | Database["public"]["Enums"]["notification_status"]
            | null
          id: string | null
          message_body: string | null
          provider_msg_id: string | null
          recipient_phone: string | null
          school_id: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["notification_status"]
            | null
          id?: string | null
          message_body?: string | null
          provider_msg_id?: string | null
          recipient_phone?: string | null
          school_id?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["notification_status"]
            | null
          id?: string | null
          message_body?: string | null
          provider_msg_id?: string | null
          recipient_phone?: string | null
          school_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_balances"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_sync_items: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          operation: string | null
          payload: Json | null
          processed_at: string | null
          retry_count: number | null
          school_id: string | null
          status: Database["public"]["Enums"]["sync_status"] | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          operation?: string | null
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          operation?: string | null
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number | null
          school_id?: string | null
          status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_balances: {
        Row: {
          balance: number | null
          credit_count: number | null
          debit_count: number | null
          school_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_balances: {
        Row: {
          balance: number | null
          class_name: string | null
          first_name: string | null
          last_name: string | null
          last_transaction_at: string | null
          school_id: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_collections: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      activate_payments: { Args: { p_school_id: string }; Returns: Json }
      calculate_platform_fee: {
        Args: { p_amount: number; p_school_id: string }
        Returns: number
      }
      can_manage_platform_levy: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      complete_business_verification: {
        Args: {
          p_business_type: string
          p_cac_number: string
          p_school_id: string
          p_tin: string
        }
        Returns: undefined
      }
      complete_onboarding: { Args: { p_school_id: string }; Returns: Json }
      create_admin: {
        Args: { p_email: string; p_invited_by: string; p_school_id: string }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { p_name: string; p_owner_user_id: string }
        Returns: string
      }
      create_school_with_onboarding: {
        Args: {
          p_academic_calendar?: Json
          p_address?: string
          p_country?: string
          p_lga?: string
          p_name: string
          p_organization_id: string
          p_owner_user_id: string
          p_school_type?: string
          p_state?: string
        }
        Returns: string
      }
      create_school_with_owner:
        | {
            Args: {
              p_academic_calendar?: Json
              p_address?: string
              p_country?: string
              p_lga?: string
              p_name: string
              p_organization_id: string
              p_owner_user_id: string
              p_school_type?: string
              p_state?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_academic_session?: string
              p_address: string
              p_current_term?: string
              p_email: string
              p_phone: string
              p_proprietor_name: string
              p_school_name: string
              p_school_type?: string
            }
            Returns: string
          }
      current_school_id: { Args: never; Returns: string }
      enqueue_sync_payload: {
        Args: {
          entity_type_text: string
          entity_uuid: string
          operation_text: string
          payload_json: Json
        }
        Returns: string
      }
      generate_slug: { Args: { p_name: string }; Returns: string }
      get_onboarding_status: { Args: { p_user_id: string }; Returns: Json }
      get_primary_payment_account: {
        Args: { p_student_id: string }
        Returns: {
          account_name: string | null
          account_number: string
          account_reference: string
          account_status: string
          bank_name: string
          created_at: string
          deactivated_at: string | null
          id: string
          idempotency_key: string | null
          is_primary: boolean
          provider: string | null
          provider_account_id: string | null
          provider_event_ref: string | null
          provider_name: string
          provider_reference: string | null
          provider_student_reference: string | null
          provisioning_error: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
          virtual_account_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_accounts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_tuition_for_student: {
        Args: {
          p_academic_session: string
          p_academic_term: Database["public"]["Enums"]["academic_term"]
          p_category: Database["public"]["Enums"]["student_category"]
          p_school_id: string
        }
        Returns: number
      }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      log_audit_action: {
        Args: {
          action_text: string
          actor_uuid: string
          entity_name: string
          entity_uuid: string
          metadata_json?: Json
          p_school_id?: string
        }
        Returns: undefined
      }
      organization_id_for_user: { Args: { p_user_id: string }; Returns: string }
      provision_dva_for_student: {
        Args: {
          p_config_id: string
          p_dva_bank: string
          p_dva_name: string
          p_dva_number: string
          p_provider: string
          p_school_id: string
          p_student_id: string
        }
        Returns: Json
      }
      provision_student_dva_and_charges: {
        Args: {
          p_academic_session?: string
          p_academic_term?: Database["public"]["Enums"]["academic_term"]
          p_category: Database["public"]["Enums"]["student_category"]
          p_class_name: string
          p_first_name: string
          p_guardian_email?: string
          p_guardian_full_name: string
          p_guardian_primary_phone: string
          p_guardian_secondary_phone?: string
          p_last_name: string
          p_relationship?: string
          p_school_id: string
        }
        Returns: Json
      }
      reactivate_admin: {
        Args: { p_actor_id?: string; p_admin_id: string; p_school_id: string }
        Returns: undefined
      }
      record_verified_payment: {
        Args: {
          p_amount_minor: number
          p_currency?: string
          p_entry_category?: string
          p_gateway_txn_ref: string
          p_idempotency_key?: string
          p_payment_method?: string
          p_provider_event_id: string
          p_raw_payload?: Json
          p_reference: string
          p_school_id: string
          p_student_id: string
        }
        Returns: Json
      }
      remove_admin: {
        Args: { p_actor_id?: string; p_admin_id: string; p_school_id: string }
        Returns: undefined
      }
      school_balance: { Args: { target_school_id: string }; Returns: number }
      school_id_for_profile: { Args: { profile_uuid: string }; Returns: string }
      school_id_for_student: { Args: { student_uuid: string }; Returns: string }
      school_id_for_user: { Args: { p_user_id: string }; Returns: string }
      student_balance: { Args: { target_student_id: string }; Returns: number }
      suspend_admin: {
        Args: { p_actor_id?: string; p_admin_id: string; p_school_id: string }
        Returns: undefined
      }
      tenant_matches_school: {
        Args: { target_school_id: string }
        Returns: boolean
      }
      transfer_ownership: {
        Args: {
          p_current_owner_id: string
          p_new_owner_id: string
          p_school_id: string
        }
        Returns: undefined
      }
      trigger_apply_student_base_fees: {
        Args: { tech_levy_amount?: number; tuition_amount?: number }
        Returns: {
          student_id: string
          student_name: string
          tech_levy_id: string
          tuition_id: string
        }[]
      }
      update_onboarding_stage: {
        Args: { p_completed_steps: Json; p_school_id: string; p_stage: number }
        Returns: undefined
      }
      upsert_payment_account: {
        Args: {
          p_account_name: string
          p_account_status: string
          p_bank_name: string
          p_provider: string
          p_provider_account_id: string
          p_provider_reference: string
          p_school_id: string
          p_student_id: string
          p_virtual_account_number: string
        }
        Returns: Json
      }
      verify_settlement_account: {
        Args: {
          p_account_name: string
          p_account_number: string
          p_bank: string
          p_school_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      academic_term: "FIRST" | "SECOND" | "THIRD"
      admin_status: "ACTIVE" | "SUSPENDED"
      dva_status: "PENDING" | "PROVISIONING" | "ACTIVE" | "FAILED" | "DISABLED"
      guardian_relationship: "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER"
      kyc_status: "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED"
      ledger_entry_category:
        | "TUITION"
        | "TECH_LEVY"
        | "BOOKS"
        | "UNIFORM"
        | "TRANSPORT"
        | "EXAM"
        | "OTHER"
        | "DISCOUNT"
        | "REFUND"
        | "ADJUSTMENT"
        | "PLATFORM_FEE"
        | "PLATFORM_BANKING_FEE"
      ledger_entry_type: "DEBIT" | "CREDIT"
      notification_status: "PENDING" | "SENT" | "FAILED"
      payment_status:
        | "NOT_READY"
        | "PENDING_KYC"
        | "UNDER_REVIEW"
        | "READY"
        | "REJECTED"
        | "SUSPENDED"
      payment_txn_status:
        | "PENDING"
        | "PROCESSING"
        | "SUCCESS"
        | "FAILED"
        | "REVERSED"
      profile_role: "OWNER" | "ADMIN" | "BURSAR"
      school_status: "PENDING_SETUP" | "ACTIVE" | "SUSPENDED" | "ARCHIVED"
      student_category: "NURSERY" | "PRIMARY" | "SECONDARY"
      student_status: "ACTIVE" | "GRADUATED" | "LEFT"
      sync_status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      academic_term: ["FIRST", "SECOND", "THIRD"],
      admin_status: ["ACTIVE", "SUSPENDED"],
      dva_status: ["PENDING", "PROVISIONING", "ACTIVE", "FAILED", "DISABLED"],
      guardian_relationship: ["FATHER", "MOTHER", "GUARDIAN", "OTHER"],
      kyc_status: ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"],
      ledger_entry_category: [
        "TUITION",
        "TECH_LEVY",
        "BOOKS",
        "UNIFORM",
        "TRANSPORT",
        "EXAM",
        "OTHER",
        "DISCOUNT",
        "REFUND",
        "ADJUSTMENT",
        "PLATFORM_FEE",
        "PLATFORM_BANKING_FEE",
      ],
      ledger_entry_type: ["DEBIT", "CREDIT"],
      notification_status: ["PENDING", "SENT", "FAILED"],
      payment_status: [
        "NOT_READY",
        "PENDING_KYC",
        "UNDER_REVIEW",
        "READY",
        "REJECTED",
        "SUSPENDED",
      ],
      payment_txn_status: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "REVERSED",
      ],
      profile_role: ["OWNER", "ADMIN", "BURSAR"],
      school_status: ["PENDING_SETUP", "ACTIVE", "SUSPENDED", "ARCHIVED"],
      student_category: ["NURSERY", "PRIMARY", "SECONDARY"],
      student_status: ["ACTIVE", "GRADUATED", "LEFT"],
      sync_status: ["PENDING", "SYNCING", "SYNCED", "FAILED"],
    },
  },
} as const
