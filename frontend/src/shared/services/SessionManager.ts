/**
 * Session management service for Capstone authentication
 * Implements inactivity timeout (30 min) and absolute session timeout (8 hours)
 */

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours in ms
const WARNING_BEFORE_TIMEOUT = 60 * 1000; // 60 seconds warning

// Session state
let lastActivityTime: number = Date.now();
let sessionStartTime: number = Date.now();
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let authenticatedCallback: (() => void) | null = null;
let logoutCallback: (() => void) | null = null;

/**
 * Update last activity timestamp
 */
function updateActivity(): void {
  lastActivityTime = Date.now();
  
  // Reset inactivity timer if authenticated
  if (inactivityTimer && authenticatedCallback) {
    resetInactivityTimer();
  }
}

/**
 * Reset the inactivity timer
 */
function resetInactivityTimer(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  inactivityTimer = setTimeout(() => {
    if (logoutCallback) {
      logoutCallback();
    }
  }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);
}

/**
 * Set up activity listeners
 */
function setupActivityListeners(): void {
  const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
  
  events.forEach(event => {
    window.addEventListener(event, updateActivity, { passive: true });
  });
}

/**
 * Clean up activity listeners
 */
function cleanupActivityListeners(): void {
  const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
  
  events.forEach(event => {
    window.removeEventListener(event, updateActivity);
  });
}

export class SessionManager {
  /**
   * Initialize session management
   * @param onAuthenticated - Called when user becomes authenticated
   * @param onLogout - Called when session times out
   */
  static init(onAuthenticated: () => void, onLogout: () => void): void {
    authenticatedCallback = onAuthenticated;
    logoutCallback = onLogout;
    
    lastActivityTime = Date.now();
    sessionStartTime = Date.now();
    
    setupActivityListeners();
    
    // Start absolute timeout check
    setInterval(() => {
      const elapsed = Date.now() - sessionStartTime;
      if (elapsed >= ABSOLUTE_TIMEOUT && logoutCallback) {
        logoutCallback();
      }
    }, 60 * 1000); // Check every minute
  }
  
  /**
   * Called when user authenticates successfully
   */
  static onAuthenticated(): void {
    lastActivityTime = Date.now();
    sessionStartTime = Date.now();
    resetInactivityTimer();
  }
  
  /**
   * Called when user logs out
   */
  static onLogout(): void {
    lastActivityTime = Date.now();
    sessionStartTime = Date.now();
    
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }
  
  /**
   * Get remaining inactivity time in seconds
   */
  static getRemainingInactivityTime(): number {
    return Math.max(0, Math.floor((INACTIVITY_TIMEOUT - (Date.now() - lastActivityTime)) / 1000));
  }
  
  /**
   * Get remaining absolute session time in seconds
   */
  static getRemainingSessionTime(): number {
    return Math.max(0, Math.floor((ABSOLUTE_TIMEOUT - (Date.now() - sessionStartTime)) / 1000));
  }
  
  /**
   * Check if session is expired due to inactivity
   */
  static isInactiveExpired(): boolean {
    return Date.now() - lastActivityTime >= INACTIVITY_TIMEOUT;
  }
  
  /**
   * Check if session is expired due to absolute timeout
   */
  static isAbsoluteExpired(): boolean {
    return Date.now() - sessionStartTime >= ABSOLUTE_TIMEOUT;
  }
}