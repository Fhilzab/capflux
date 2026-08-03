                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        /**
 * RBAC Error Codes and Friendly Messages
 */

import { RBACErrorCode } from './types';

export const RBAC_ERROR_MESSAGES: Record<RBACErrorCode, string> = {
  [RBACErrorCode.ROLE_NOT_FOUND]: 'The requested role could not be found.',
  [RBACErrorCode.PERMISSION_NOT_FOUND]: 'The requested permission could not be found.',
  [RBACErrorCode.MEMBERSHIP_NOT_FOUND]: 'You are not a member of this school or organization.',
  [RBACErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action.',
  [RBACErrorCode.MULTIPLE_SCHOOLS_NOT_ALLOWED]: 'This role is not allowed to belong to multiple schools.',
  [RBACErrorCode.SCHOOL_ACCESS_DENIED]: 'You do not have access to this school.',
  [RBACErrorCode.ORGANIZATION_ACCESS_DENIED]: 'You do not have access to this organization.',
  [RBACErrorCode.PLATFORM_LEVY_ACCESS_DENIED]: 'Only platform administrators can manage platform levy.',
  [RBACErrorCode.SUPER_ADMIN_REQUIRED]: 'Super administrator access is required for this operation.',                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
  [RBACErrorCode.INVALID_ROLE_ASSIGNMENT]: 'The role assignment violates platform rules.',
};

/**
 * Get a friendly error message for an RBAC error code
 */
export function getRBACErrorMessage(code: RBACErrorCode): string {
  return RBAC_ERROR_MESSAGES[code] || 'An authorization error occurred.';
}