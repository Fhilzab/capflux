import type { AccessScope } from './types';

export const buildAccessScope = (
  userId: string,
  organizationId: string | null,
  schoolId: string | null
): AccessScope => {
  if (!organizationId || !schoolId) {
    return { type: 'PLATFORM', userId };
  }

  return {
    type: 'SCHOOL',
    userId,
    organizationId,
    schoolId,
  };
};
