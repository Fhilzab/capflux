import { defineStore } from 'pinia';
import { ProfileService } from '@/shared/services/ProfileService';
import { SchoolService } from '@/shared/services/SchoolService';
import type { School, Profile, AcademicSession, AcademicTerm, OnboardingProgress, SchoolStatus, ProfileRole, AdminStatus } from '@/features/school/types';

const profileService = new ProfileService();
const schoolService = new SchoolService();

/**
 * SchoolStore - Centralized School Context store
 * Single source of truth for tenant information
 */
export const useSchoolStore = defineStore('school', {
  state: () => ({
    // School data
    school: null as School | null,
    schoolId: null as string | null,
    schoolName: null as string | null,
    operationalStatus: 'ONBOARDING' as SchoolStatus,
    schoolLevel: null as string | null,
    genderType: null as string | null,

    // Profile
    profile: null as Profile | null,
    role: null as ProfileRole | null,
    adminStatus: 'ACTIVE' as AdminStatus,

    // Academic context (financial calendar)
    currentSession: null as AcademicSession | null,
    currentTerm: null as AcademicTerm | null,
    sessions: [] as AcademicSession[],
    terms: [] as AcademicTerm[],

    // Onboarding
    onboardingProgress: null as OnboardingProgress | null,
    isReady: false,

    // Loading states
    loading: false,
    initialized: false,
    error: null as string | null,
  }),

  getters: {
    isOwner: (state): boolean => state.role === 'OWNER',
    isAdmin: (state): boolean => state.role === 'ADMIN',
    isOnboarding: (state): boolean => state.operationalStatus === 'ONBOARDING',
    isActive: (state): boolean => state.operationalStatus === 'ACTIVE',
  },

  actions: {
    async initialize() {
      // Prevent multiple initializations
      if (this.initialized) return;

      this.loading = true;
      this.error = null;

      // 1. Load profile first (required)
      const profile = await profileService.getProfile();
      if (!profile) {
        // No profile - user may not be authenticated or profile not set up yet
        this.initialized = true;
        this.loading = false;
        return;
      }

      this.profile = profile;
      this.role = profile.role;
      this.adminStatus = profile.admin_status;

      // 2. Load school using profile.school_id (required for school context)
      if (profile.school_id) {
        this.schoolId = profile.school_id;
        const school = await schoolService.getSchool(profile.school_id);
        
        if (school) {
          this.school = school;
          this.schoolName = school.name;
          this.operationalStatus = school.operational_status;
          this.schoolLevel = school.school_level;
          this.genderType = school.gender_type;
        }
      }

      // 3. Load academic context (sessions) - optional, don't fail if missing
      if (this.schoolId) {
        try {
          this.sessions = await schoolService.getSessions(this.schoolId);
          this.currentSession = this.sessions.find(s => s.is_current) ?? null;
        } catch (err) {
          console.warn('SchoolStore: Failed to load sessions', err);
        }
      }

      // 4. Load terms - optional, don't fail if missing
      if (this.currentSession?.id) {
        try {
          this.terms = await schoolService.getTerms(this.schoolId!, this.currentSession.id);
          this.currentTerm = this.terms.find(t => t.is_current) ?? null;
        } catch (err) {
          console.warn('SchoolStore: Failed to load terms', err);
        }
      }

      // 5. Load onboarding progress - optional, don't fail if missing
      if (this.schoolId) {
        try {
          this.onboardingProgress = await schoolService.getOnboardingProgress(this.schoolId);
        } catch (err) {
          console.warn('SchoolStore: Failed to load onboarding progress', err);
        }
      }

      // 6. Check readiness - optional, don't fail if RPC missing
      if (this.schoolId) {
        try {
          this.isReady = await schoolService.isReady(this.schoolId);
        } catch (err) {
          console.warn('SchoolStore: Failed to check school readiness', err);
          this.isReady = false;
        }
      }

      // Always mark as initialized to prevent re-initialization loops
      this.initialized = true;
      this.loading = false;
    },

    async refresh() {
      // Reset initialization state to allow re-fetch
      this.initialized = false;
      await this.initialize();
    },

    clear() {
      this.$reset();
    },
  },

});