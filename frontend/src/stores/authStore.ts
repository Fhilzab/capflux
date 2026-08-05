import { defineStore } from 'pinia';
import { AuthService } from '../shared/auth/AuthService';
import { organizationService } from '../shared/organization/OrganizationService';
import { rbacService } from '../shared/rbac/RBACService';
import type { Organization, OrganizationMembership, OrganizationRole } from '../shared/organization/types';

export interface User {
  id: string;
  email: string;
  role?: 'OWNER' | 'ADMIN';
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user?: User;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    session: null as Session | null,
    loading: false as boolean,
    error: null as string | null,
    schoolId: null as string | null,
    role: null as 'OWNER' | 'ADMIN' | null,
    adminStatus: 'ACTIVE' as string,
    profile: null as Record<string, unknown> | null,
    schoolSetupComplete: false as boolean,
    emailVerified: false as boolean,
    initialized: false as boolean,
    // Organization state
    organization: null as Organization | null,
    membership: null as OrganizationMembership | null,
    organizationInitialized: false as boolean,
  }),
  getters: {
    isAuthenticated: (state): boolean => !!state.user,
    // Backward compatibility - derived from organization
    currentSchoolId: (state): string | null => state.organization?.id ?? state.schoolId,
    // Backward compatibility - derived from membership
    currentRole: (state): 'OWNER' | 'ADMIN' | null => state.membership?.role ?? state.role,
    isOwner: (state): boolean => (state.membership?.role ?? state.role) === 'OWNER',
    isAdmin: (state): boolean => (state.membership?.role ?? state.role) === 'ADMIN',
    isSchoolSetupComplete: (state): boolean => state.schoolSetupComplete && !!state.schoolId,
    // New organization-aware getters
    currentOrganization: (state): Organization | null => state.organization,
    currentOrganizationId: (state): string | null => state.organization?.id ?? null,
  },
  actions: {
    async initialize() {
      const { session, error } = await AuthService.initialize();
      if (error) {
        this.error = error.message;
      }

      this.session = session;
      this.user = session?.user ?? null;
      this.schoolId = null;
      this.initialized = true;

      AuthService.onAuthStateChange((_event, sessionUpdate) => {
        this.session = sessionUpdate;
        this.user = sessionUpdate?.user ?? null;
        if (sessionUpdate) {
          this.loadOrganization();
        } else {
          this.schoolId = null;
          this.organization = null;
          this.membership = null;
          this.organizationInitialized = false;
        }
      });

      // Load organization if authenticated (non-blocking)
      if (session) {
        await this.loadOrganization();
      }
    },

    async loadOrganization() {
      const result = await organizationService.loadOrganization();
      
      this.organization = result.data?.organization ?? null;
      this.membership = result.data?.membership ?? null;
      this.organizationInitialized = true;
      
      // Backward compatibility - populate legacy fields
      if (this.organization) {
        this.schoolId = this.organization.id;
        this.role = this.membership?.role ?? null;
        this.adminStatus = this.membership?.status ?? 'ACTIVE';
      } else {
        this.schoolId = null;
        this.role = null;
        this.adminStatus = 'ACTIVE';
      }
    },

    async refreshOrganization() {
      const result = await organizationService.refreshOrganization();
      
      this.organization = result.data?.organization ?? null;
      this.membership = result.data?.membership ?? null;
      this.organizationInitialized = true;
      
      // Backward compatibility
      if (this.organization) {
        this.schoolId = this.organization.id;
        this.role = this.membership?.role ?? null;
        this.adminStatus = this.membership?.status ?? 'ACTIVE';
      }
    },

    async clearOrganization() {
      await organizationService.clearOrganization();
      this.organization = null;
      this.membership = null;
      this.organizationInitialized = false;
      this.schoolId = null;
      this.role = null;
      this.adminStatus = 'ACTIVE';
    },

    async signIn({ email, password }: { email: string; password: string }) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signIn(email, password);

      this.loading = false;

      if (error) {
        this.error = error.message;
        return false;
      }

      this.session = data?.session ?? null;
      this.user = data?.user ?? null;

      if (data?.session) {
        await this.loadOrganization();
      }

      return true;
    },

    async signUp({ fullName, email, password }: { fullName: string; email: string; password: string }) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signUp(email, password, fullName);

      this.loading = false;

      if (error) {
        this.error = error.message;
        return { error };
      }

      return { data, error: null };
    },

    async signInWithProvider(provider: string) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signInWithProvider(provider);

      this.loading = false;

      if (error) {
        this.error = error.message;
        return false;
      }

      if (data?.session) {
        this.session = data.session;
        this.user = data.user ?? null;
        await this.loadOrganization();
      }

      return true;
    },

    async handleOAuthCallback(code: string) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.handleOAuthCallback(code);

      this.loading = false;

      if (error) {
        this.error = error.message;
        return false;
      }

      this.session = data?.session ?? null;
      this.user = data?.user ?? null;

      if (data?.session) {
        await this.loadOrganization();
      }

      return true;
    },

    async refreshSession() {
      const { session } = await AuthService.refreshSession();
      this.session = session;
      this.user = session?.user ?? null;
      if (session) {
        await this.loadOrganization();
      }
      return { session };
    },

    async signOut() {
      await AuthService.signOut();
      rbacService.clearCache();
      // Clear all auth state
      this.user = null;
      this.session = null;
      this.schoolId = null;
      this.role = null;
      this.profile = null;
      this.schoolSetupComplete = false;
      this.emailVerified = false;
      this.error = null;
      this.loading = false;
      this.initialized = false;
      // Clear organization state
      this.organization = null;
      this.membership = null;
      this.organizationInitialized = false;
      this.adminStatus = 'ACTIVE';
    },
  },
});