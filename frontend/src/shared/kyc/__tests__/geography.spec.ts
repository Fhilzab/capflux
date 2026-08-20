import { describe, it, expect } from 'vitest';
import {
  getCountryOptions,
  getStatesForCountry,
  getLgasForState,
  hasStructuredStates,
  normalizeCountry,
  NIGERIAN_STATES,
} from '@/shared/kyc/geography';

describe('geography data', () => {
  describe('country options', () => {
    it('includes all required West African countries', () => {
      const options = getCountryOptions();
      const labels = options.map((o) => o.label);

      expect(labels).toContain('Nigeria');
      expect(labels).toContain('Ghana');
      expect(labels).toContain('Sierra Leone');
      expect(labels).toContain('Liberia');
      expect(labels).toContain('The Gambia');
      expect(labels).toContain('Senegal');
      expect(labels).toContain('Guinea');
      expect(labels).toContain('Guinea-Bissau');
      expect(labels).toContain('Mali');
      expect(labels).toContain('Burkina Faso');
      expect(labels).toContain('Côte d\'Ivoire');
      expect(labels).toContain('Togo');
      expect(labels).toContain('Benin');
      expect(labels).toContain('Niger');
      expect(labels).toContain('Cabo Verde');
      expect(labels).toContain('Mauritania');
    });

    it('uses canonical country values', () => {
      const options = getCountryOptions();
      expect(options.find((o) => o.value === 'Nigeria')).toBeDefined();
      expect(options.find((o) => o.value === 'Côte d\'Ivoire')).toBeDefined();
    });
  });

  describe('normalizeCountry', () => {
    it('normalizes lowercase variant to canonical name', () => {
      expect(normalizeCountry('nigeria')).toBe('Nigeria');
      expect(normalizeCountry('ghana')).toBe('Ghana');
    });

    it('normalizes country code to canonical name', () => {
      expect(normalizeCountry('NG')).toBe('Nigeria');
      expect(normalizeCountry('ng')).toBe('Nigeria');
      expect(normalizeCountry('GH')).toBe('Ghana');
    });

    it('preserves canonical names', () => {
      expect(normalizeCountry('Nigeria')).toBe('Nigeria');
      expect(normalizeCountry('Cabo Verde')).toBe('Cabo Verde');
    });

    it('returns default Nigeria for empty/null input', () => {
      expect(normalizeCountry(null)).toBe('Nigeria');
      expect(normalizeCountry(undefined)).toBe('Nigeria');
      expect(normalizeCountry('')).toBe('Nigeria');
    });

    it('returns input unchanged for unknown countries', () => {
      expect(normalizeCountry('United States')).toBe('United States');
      expect(normalizeCountry('united states')).toBe('united states');
    });
  });

  describe('hasStructuredStates', () => {
    it('returns true for Nigeria', () => {
      expect(hasStructuredStates('Nigeria')).toBe(true);
    });

    it('returns false for non-Nigeria countries', () => {
      expect(hasStructuredStates('Ghana')).toBe(false);
      expect(hasStructuredStates('United States')).toBe(false);
    });
  });

  describe('Nigerian states', () => {
    it('includes all 36 states + FCT', () => {
      const states = NIGERIAN_STATES;
      expect(states.length).toBe(37);
      expect(states.some((s) => s.value === 'Federal Capital Territory')).toBe(true);
      expect(states.some((s) => s.value === 'Lagos')).toBe(true);
      expect(states.some((s) => s.value === 'Kano')).toBe(true);
      expect(states.some((s) => s.value === 'Ondo')).toBe(true);
    });

    it('getStatesForCountry returns 37 states for Nigeria', () => {
      const states = getStatesForCountry('Nigeria');
      expect(states.length).toBe(37);
    });

    it('getStatesForCountry returns empty for non-Nigeria', () => {
      const states = getStatesForCountry('Ghana');
      expect(states.length).toBe(0);
    });
  });

  describe('LGA dependency', () => {
    const testCities = ['Lagos Mainland', 'Ikeja', 'Epe', 'Lagos Island'];

    it('returns LGAs for a valid Nigerian state', () => {
      const lgas = getLgasForState('Lagos');
      expect(lgas.length).toBeGreaterThan(0);
      const labels = lgas.map((l) => l.label);
      expect(labels.some((l) => testCities.includes(l))).toBe(true);
    });

    it('returns empty for non-Nigerian state', () => {
      const lgas = getLgasForState('Accra');
      expect(lgas.length).toBe(0);
    });

    it('returns empty for empty state', () => {
      const lgas = getLgasForState('');
      expect(lgas.length).toBe(0);
    });

    it('returns different LGAs for different states', () => {
      const lagosLgas = getLgasForState('Lagos');
      const ondoLgas = getLgasForState('Ondo');
      expect(lagosLgas.length).toBeGreaterThan(0);
      expect(ondoLgas.length).toBeGreaterThan(0);
      const lagosLabels = new Set(lagosLgas.map((l) => l.label));
      const ondoLabels = new Set(ondoLgas.map((l) => l.label));
      expect(lagosLabels.has('Ondo')).toBe(false);
      expect(ondoLabels.has('Owo')).toBe(true);
    });
  });
});
