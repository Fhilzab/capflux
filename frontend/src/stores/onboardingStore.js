import { defineStore } from 'pinia';
import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';

export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({
    currentStep: 1,
    totalSteps: 3,
    schoolId: null,
    completedSteps: [],
    progress: 0,
    // Stage 1 data
    schoolName: '',
    proprietorName: '',
    email: '',
    phone: '',
    address: '',
    schoolType: 'MIXED',
    academicSession: '2024/2025',
    currentTerm: 'FIRST',
    // Stage 2 data
    proprietorBvn: '',
    proprietorNin: '',
    businessType: 'SOLE_PROPRIETOR',
    cacNumber: '',
    tin: '',
    settlementBank: '',
    settlementAccountNumber: '',
    settlementAccountName: '',
    businessVerified: false,
    settlementVerified: false,
    // Stage 3 flags
    paymentServiceReady: false,
    activated: false,
  }),

  getters: {
    isStage1Complete: (state) => !!state.schoolId,
    isStage2Complete: (state) => state.businessVerified && state.settlementVerified,
    isStage3Complete: (state) => state.activated,
    canProceedToNext: (state) => {
      if (state.currentStep === 1) return state.isStage1Complete;
      if (state.currentStep === 2) return state.isStage2Complete;
      if (state.currentStep === 3) return state.activated;
      return false;
    },
  },

  actions: {
    async initialize() {
      // Check local storage for progress
      const saved = localStorage.getItem('onboardingProgress');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this, parsed);
      }

      // If we have a schoolId, fetch server state
      if (this.schoolId && hasSupabaseConfig) {
        await this.fetchServerProgress();
      }
    },

    async fetchServerProgress() {
      if (!hasSupabaseConfig || !this.schoolId) return;

      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('school_id', this.schoolId)
        .single();

      if (!error && data) {
        this.currentStep = data.stage;
        this.completedSteps = data.completed_steps || [];
        this.businessVerified = data.business_verified;
        this.settlementVerified = data.settlement_verified;
        this.paymentServiceReady = data.payment_service_ready;
        this.activated = data.activated;
      }
    },

    saveProgress() {
      localStorage.setItem('onboardingProgress', JSON.stringify({
        currentStep: this.currentStep,
        schoolId: this.schoolId,
        completedSteps: this.completedSteps,
        businessVerified: this.businessVerified,
        settlementVerified: this.settlementVerified,
        paymentServiceReady: this.paymentServiceReady,
        activated: this.activated,
      }));

      // Calculate progress percentage
      this.progress = Math.round((this.completedSteps.length / 7) * 100);
    },

    async setStage(stage) {
      this.currentStep = stage;
      if (this.schoolId && hasSupabaseConfig) {
        await supabase.rpc('update_onboarding_stage', {
          p_school_id: this.schoolId,
          p_stage: stage,
          p_completed_steps: this.completedSteps,
        });
      }
      this.saveProgress();
    },

    async completeStep(stepName) {
      if (!this.completedSteps.includes(stepName)) {
        this.completedSteps.push(stepName);
      }
      this.saveProgress();
    },

    async createSchool(formData) {
      if (!hasSupabaseConfig) {
        this.schoolId = 'demo-school';
        this.schoolName = formData.schoolName;
        this.proprietorName = formData.proprietorName;
        this.email = formData.email;
        this.phone = formData.phone;
        this.address = formData.address;
        this.schoolType = formData.schoolType;
        this.academicSession = formData.academicSession;
        this.currentTerm = formData.currentTerm;
        this.saveProgress();
        return { schoolId: this.schoolId, success: true };
      }

      const { data, error } = await supabase.rpc('create_school_with_owner', {
        p_school_name: formData.schoolName,
        p_proprietor_name: formData.proprietorName,
        p_email: formData.email,
        p_phone: formData.phone,
        p_address: formData.address,
        p_school_type: formData.schoolType,
        p_academic_session: formData.academicSession,
        p_current_term: formData.currentTerm,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.schoolId = data;
      this.saveProgress();
      return { schoolId: data, success: true };
    },

    async completeBusinessVerification(formData) {
      this.proprietorBvn = formData.proprietorBvn;
      this.proprietorNin = formData.proprietorNin;
      this.businessType = formData.businessType;
      this.cacNumber = formData.cacNumber;
      this.tin = formData.tin;
      
      if (this.schoolId && hasSupabaseConfig) {
        await supabase.rpc('complete_business_verification', {
          p_school_id: this.schoolId,
          p_bvn: formData.proprietorBvn,
          p_nin: formData.proprietorNin,
          p_business_type: formData.businessType,
          p_cac_number: formData.cacNumber,
          p_tin: formData.tin,
        });
      }
      
      this.businessVerified = true;
      await this.completeStep('business_verification');
      this.saveProgress();
    },

    async verifySettlementAccount(formData) {
      this.settlementBank = formData.bank;
      this.settlementAccountNumber = formData.accountNumber;
      this.settlementAccountName = formData.accountName;
      
      if (this.schoolId && hasSupabaseConfig) {
        await supabase.rpc('verify_settlement_account', {
          p_school_id: this.schoolId,
          p_bank: formData.bank,
          p_account_number: formData.accountNumber,
          p_account_name: formData.accountName,
        });
      }
      
      this.settlementVerified = true;
      await this.completeStep('settlement_verification');
      this.saveProgress();
    },

    async activateCollections() {
      if (this.schoolId && hasSupabaseConfig) {
        await supabase.rpc('activate_collections', {
          p_school_id: this.schoolId,
        });
      }
      
      this.activated = true;
      this.paymentServiceReady = true;
      await this.completeStep('collections_activated');
      this.saveProgress();
    },

    reset() {
      this.$reset();
      localStorage.removeItem('onboardingProgress');
    },
  },
});