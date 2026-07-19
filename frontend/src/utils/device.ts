/**
 * Device identification utilities for Capstone authentication
 * Creates device fingerprints for trusted device registration (Phase 2)
 */

/**
 * Generate a stable device fingerprint
 * Uses browser characteristics that are reasonably stable across sessions
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server-side';
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    !!window.indexedDB,
  ];

  // Create a hash of the components
  const fingerprint = components
    .map(c => String(c))
    .join('|');

  // Simple hash function (not cryptographically secure, but good enough for device ID)
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `dev_${Math.abs(hash).toString(36)}`;
}

/**
 * Get or create a device ID for the current browser
 * Stores in localStorage to maintain consistency across sessions
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server-side';
  }

  const stored = localStorage.getItem('capstone_device_id');
  if (stored) {
    return stored;
  }

  const newId = generateDeviceFingerprint();
  localStorage.setItem('capstone_device_id', newId);
  return newId;
}

/**
 * Get device info for analytics/display purposes
 */
export function getDeviceInfo(): {
  userAgent: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
} {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'server-side',
      language: 'en',
      screenWidth: 0,
      screenHeight: 0,
      timezone: 'UTC',
    };
  }

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Clear stored device ID (used when user logs out)
 */
export function clearDeviceId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('capstone_device_id');
  }
}