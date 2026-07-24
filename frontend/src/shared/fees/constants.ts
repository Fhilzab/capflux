/**
 * Capstone platform fee constants
 */

export const PLATFORM_FEE_CODES = {
  TECHNOLOGY_LEVY: 'TECH_LEVY',
} as const;

export type PlatformFeeCode = keyof typeof PLATFORM_FEE_CODES;