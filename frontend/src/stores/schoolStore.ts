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

      try {
        // 1. Load profile first
        const profile = await profileService.getProfile();
        if (!profile) {
          this.initialized = true;
          this.loading = false;
          return; // Not authenticated or no profile exists
        }

        this.profile = profile;
        this.role = profile.role;
        this.adminStatus = profile.admin_status;

        // 2. Load school using profile.school_id
        if (profile.school_id) {
          this.schoolId = profile.school_id;
          const school = await schoolService.getSchool(profile.school_id);
          if (school) {
            this.school = school;
            this.schoolName = school.name;
            this.operationalStatus = school.operational_status;
            this.schoolLevel = school.school_level;
            this.genderType = school.gender_type;

            // 3. Load academic context (sessions & terms)
            this.sessions = await schoolService.getSessions(profile.school_id);
            this.currentSession = this.sessions.find(s => s.is_current) ?? null;
            
            if (this.currentSession) {
              this.terms = await schoolService.getTerms(profile.school_id, this.currentSession.id);
              this.currentTerm = this.terms.find(t => t.is_current) ?? null;
            }

            // 4. Load onboarding progress
            this.onboardingProgress = await schoolService.getOnboardingProgress(profile.school_id);
            
            // 5. Check readiness
            this.isReady = await schoolService.isReady(profile.school_id);
          }
        }

        this.initialized = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load school context';
        console.error('SchoolStore initialization failed:', err);
      } finally {
        this.loading = false;
      }
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