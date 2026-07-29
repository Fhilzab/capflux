/**
 * NotificationPreferenceProvider
 *
 * Responsible for determining allowed channels.
 * NotificationService never contains preference logic.
 *
 * Responsibilities:
 * - getStudentPreferences()
 * - getGuardianPreferences()
 * - getEnabledChannels()
 * - applyDefaults()
 */

import type { NotificationChannel, NotificationPreference } from './types';

/**
 * Default preferences applied when no explicit preference exists.
 * All channels enabled by default.
 */
const DEFAULT_ENABLED_CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'];

export class NotificationPreferenceProvider {
  private preferences: Map<string, NotificationPreference[]> = new Map();

  /**
   * Get preferences for a student.
   * Returns preferences keyed by studentId.
   */
  getStudentPreferences(studentId: string): NotificationPreference[] {
    return this.preferences.get(`student:${studentId}`) || [];
  }

  /**
   * Get preferences for a guardian.
   * Returns preferences keyed by guardianId.
   */
  getGuardianPreferences(guardianId: string): NotificationPreference[] {
    return this.preferences.get(`guardian:${guardianId}`) || [];
  }

  /**
   * Get the enabled channels for a student (combining student and guardian preferences).
   * If no preferences are set, returns default enabled channels.
   */
  getEnabledChannels(studentId: string, guardianId?: string): NotificationChannel[] {
    const studentPrefs = this.getStudentPreferences(studentId);
    const guardianPrefs = guardianId ? this.getGuardianPreferences(guardianId) : [];

    const allPrefs = [...studentPrefs, ...guardianPrefs];

    // If no preferences exist, return defaults
    if (allPrefs.length === 0) {
      return [...DEFAULT_ENABLED_CHANNELS];
    }

    // Filter channels by enabled status
    const enabled: NotificationChannel[] = [];
    const channelEnabled = new Map<NotificationChannel, boolean>();

    for (const pref of allPrefs) {
      // Guardian preferences take precedence over student preferences
      if (!channelEnabled.has(pref.channel) || pref.studentId === studentId) {
        channelEnabled.set(pref.channel, pref.enabled);
      }
    }

    for (const [channel, enabled_] of channelEnabled) {
      if (enabled_) {
        enabled.push(channel);
      }
    }

    // If no channels are enabled after filtering, return defaults
    if (enabled.length === 0) {
      return [...DEFAULT_ENABLED_CHANNELS];
    }

    return enabled;
  }

  /**
   * Filter a list of requested channels to only those that are enabled.
   */
  filterEnabledChannels(
    requestedChannels: NotificationChannel[],
    studentId: string,
    guardianId?: string,
  ): NotificationChannel[] {
    const enabled = this.getEnabledChannels(studentId, guardianId);
    return requestedChannels.filter(c => enabled.includes(c));
  }

  /**
   * Apply default preferences to a student.
   * Creates default preferences if none exist.
   */
  applyDefaults(studentId: string): void {
    const key = `student:${studentId}`;
    if (!this.preferences.has(key)) {
      const now = new Date().toISOString();
      const prefs: NotificationPreference[] = DEFAULT_ENABLED_CHANNELS.map(channel => ({
        id: `${studentId}-${channel}`,
        studentId,
        channel,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }));
      this.preferences.set(key, prefs);
    }
  }

  /**
   * Set preferences for a student.
   */
  setStudentPreferences(studentId: string, preferences: Partial<Record<NotificationChannel, boolean>>): void {
    const key = `student:${studentId}`;
    const now = new Date().toISOString();
    const prefs: NotificationPreference[] = Object.entries(preferences).map(([channel, enabled]) => ({
      id: `${studentId}-${channel}`,
      studentId,
      channel: channel as NotificationChannel,
      enabled: !!enabled,
      createdAt: now,
      updatedAt: now,
    }));
    this.preferences.set(key, prefs);
  }

  /**
   * Set preferences for a guardian.
   */
  setGuardianPreferences(guardianId: string, preferences: Partial<Record<NotificationChannel, boolean>>): void {
    const key = `guardian:${guardianId}`;
    const now = new Date().toISOString();
    const prefs: NotificationPreference[] = Object.entries(preferences).map(([channel, enabled]) => ({
      id: `${guardianId}-${channel}`,
      guardianId,
      channel: channel as NotificationChannel,
      enabled: !!enabled,
      createdAt: now,
      updatedAt: now,
    }));
    this.preferences.set(key, prefs);
  }
}
