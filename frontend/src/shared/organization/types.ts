/**
 * Organization Types
 * TypeScript interfaces for the organization context layer
 */

// Organization roles - only OWNER and ADMIN for MVP
export type OrganizationRole = 'OWNER' | 'ADMIN';

// Organization interface - represents a school
export interface Organization {
  id: string;
  name: string;
  domain?: string;
  subscriptionStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

// OrganizationMembership - user's relationship to an organization
export interface OrganizationMembership {
  organizationId: string;
  role: OrganizationRole;
  status: string;
  createdAt?: string;
}

// Full context combining both
export interface OrganizationContext {
  organization: Organization | null;
  membership: OrganizationMembership | null;
}

// Result wrapper for organization operations
export interface OrganizationResult<T> {
  data: T | null;
  error: OrganizationError | null;
}

// Organization error codes
export type OrganizationErrorCode = 
  | 'ORG_NOT_FOUND'
  | 'ORG_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

// Organization error structure
export interface OrganizationError {
  code: OrganizationErrorCode;
  message: string;
  raw?: unknown;
}