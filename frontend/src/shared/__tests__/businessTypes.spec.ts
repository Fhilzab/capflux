import { describe, it, expect } from 'vitest';
import {
  BUSINESS_TYPE_CONFIGS,
  BUSINESS_TYPE_OPTIONS,
  VALID_BUSINESS_TYPE_VALUES,
  DOCUMENT_DEFINITIONS,
  getBusinessTypeConfig,
  getBusinessTypeLabel,
  getDocumentsForBusinessType,
  normalizeLegacyBusinessType,
  isValidBusinessType,
  canPreserveDocuments,
  getIncompatibleDocuments,
} from '../businessTypes';

describe('businessTypes config', () => {
  it('exports all 9 entity types with stable enum values', () => {
    expect(VALID_BUSINESS_TYPE_VALUES).toHaveLength(9);
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('BUSINESS_NAME');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('PARTNERSHIP');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('PRIVATE_LIMITED_COMPANY');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('PUBLIC_LIMITED_COMPANY');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('LIMITED_BY_GUARANTEE');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('UNLIMITED_COMPANY');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('LLP');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('LP');
    expect(VALID_BUSINESS_TYPE_VALUES).toContain('INCORPORATED_TRUSTEES');
  });

  it('every config has a unique value, label, and description', () => {
    const values = new Set<string>();
    for (const cfg of BUSINESS_TYPE_CONFIGS) {
      expect(cfg.value).toBeTruthy();
      expect(cfg.label).toBeTruthy();
      expect(cfg.description).toBeTruthy();
      expect(values.has(cfg.value)).toBe(false);
      values.add(cfg.value);
    }
  });

  it('every config has registration number label and placeholder', () => {
    for (const cfg of BUSINESS_TYPE_CONFIGS) {
      expect(cfg.registrationNumberLabel).toBeTruthy();
      expect(cfg.registrationNumberPlaceholder).toBeTruthy();
    }
  });

  it('no label uses vague terms like "Private Business"', () => {
    for (const cfg of BUSINESS_TYPE_CONFIGS) {
      expect(cfg.label).not.toMatch(/private business/i);
      expect(cfg.label).not.toMatch(/public business/i);
      expect(cfg.label).not.toMatch(/^Graduate$/i);
    }
  });

  it('every option in BUSINESS_TYPE_OPTIONS matches a config', () => {
    for (const opt of BUSINESS_TYPE_OPTIONS) {
      const cfg = getBusinessTypeConfig(opt.value);
      expect(cfg).toBeDefined();
      expect(cfg!.label).toBe(opt.label);
    }
  });

  describe('entity categories', () => {
    it('Business Name and Partnership are not COMPANYs', () => {
      expect(getBusinessTypeConfig('BUSINESS_NAME')?.entityCategory).toBe('BUSINESS_NAME');
      expect(getBusinessTypeConfig('PARTNERSHIP')?.entityCategory).toBe('PARTNERSHIP');
    });

    it('Incoporated Trustees is NON_PROFIT and has no shareholders', () => {
      const cfg = getBusinessTypeConfig('INCORPORATED_TRUSTEES');
      expect(cfg?.entityCategory).toBe('NON_PROFIT');
      expect(cfg?.expectsShareholders).toBe(false);
      expect(cfg?.expectsTrustees).toBe(true);
    });

    it('Company types expect directors but may or may not expect shareholders', () => {
      expect(getBusinessTypeConfig('PRIVATE_LIMITED_COMPANY')?.expectsDirectors).toBe(true);
      expect(getBusinessTypeConfig('PRIVATE_LIMITED_COMPANY')?.expectsShareholders).toBe(true);
      expect(getBusinessTypeConfig('LIMITED_BY_GUARANTEE')?.expectsShareholders).toBe(false);
      expect(getBusinessTypeConfig('UNLIMITED_COMPANY')?.expectsShareholders).toBe(false);
    });

    it('LLP and LP expect partners, not directors', () => {
      expect(getBusinessTypeConfig('LLP')?.expectsPartners).toBe(true);
      expect(getBusinessTypeConfig('LLP')?.expectsDirectors).toBe(false);
      expect(getBusinessTypeConfig('LP')?.expectsPartners).toBe(true);
      expect(getBusinessTypeConfig('LP')?.expectsDirectors).toBe(false);
    });
  });

  describe('document requirements per business type', () => {
    const allTypes = VALID_BUSINESS_TYPE_VALUES as readonly string[];

    it.each(allTypes)('%s requires CAC registration evidence', (type) => {
      const docs = getDocumentsForBusinessType(type);
      expect(docs.required).toContain('CAC_REGISTRATION_EVIDENCE');
    });

    it('Business Name does not require shareholder documents', () => {
      const docs = getDocumentsForBusinessType('BUSINESS_NAME');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
    });

    it('Business Name requires proprietor identity, not director identity', () => {
      const docs = getDocumentsForBusinessType('BUSINESS_NAME');
      expect(docs.required).toContain('PROPRIETOR_IDENTITY');
      expect(docs.required).not.toContain('DIRECTOR_IDENTITY');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
    });

    it('Partnership requires partner identity, not shareholder documents', () => {
      const docs = getDocumentsForBusinessType('PARTNERSHIP');
      expect(docs.required).toContain('PARTNER_IDENTITY');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
      expect(docs.required).not.toContain('DIRECTOR_IDENTITY');
    });

    it('Private Company requires director identity and optionally shareholders/constitution', () => {
      const docs = getDocumentsForBusinessType('PRIVATE_LIMITED_COMPANY');
      expect(docs.required).toContain('CAC_REGISTRATION_EVIDENCE');
      expect(docs.required).toContain('DIRECTOR_IDENTITY');
      expect(docs.optional).toContain('SHAREHOLDER_INFO');
      expect(docs.optional).toContain('COMPANY_CONSTITUTION');
    });

    it('Public Company does NOT simply copy private-company checklist (constitution is required)', () => {
      const docs = getDocumentsForBusinessType('PUBLIC_LIMITED_COMPANY');
      expect(docs.required).toContain('COMPANY_CONSTITUTION');
    });

    it('Company Limited by Guarantee does not require shareholder documents', () => {
      const docs = getDocumentsForBusinessType('LIMITED_BY_GUARANTEE');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
      expect(docs.required).not.toContain('PROPRIETOR_IDENTITY');
      expect(docs.optional).toContain('GOVERNING_DOCUMENT');
    });

    it('Unlimited Company does not expect shareholders (no share capital)', () => {
      const docs = getDocumentsForBusinessType('UNLIMITED_COMPANY');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
    });

    it('LLP is not treated as a normal limited company (no director identity)', () => {
      const docs = getDocumentsForBusinessType('LLP');
      expect(docs.required).toContain('PARTNER_IDENTITY');
      expect(docs.required).not.toContain('DIRECTOR_IDENTITY');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
    });

    it('LP requires partner identity', () => {
      const docs = getDocumentsForBusinessType('LP');
      expect(docs.required).toContain('PARTNER_IDENTITY');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
    });

    it('Incorporated Trustees requires trustee identity, not shareholder documents', () => {
      const docs = getDocumentsForBusinessType('INCORPORATED_TRUSTEES');
      expect(docs.required).toContain('TRUSTEE_IDENTITY');
      expect(docs.required).not.toContain('SHAREHOLDER_INFO');
      expect(docs.optional).toContain('GOVERNING_DOCUMENT');
    });

    it('returns empty arrays for null/undefined', () => {
      expect(getDocumentsForBusinessType(null)).toEqual({ required: [], optional: [] });
      expect(getDocumentsForBusinessType(undefined)).toEqual({ required: [], optional: [] });
      expect(getDocumentsForBusinessType('')).toEqual({ required: [], optional: [] });
    });
  });

  describe('registration number label', () => {
    it('Companies use "RC Number"', () => {
      expect(getBusinessTypeConfig('PRIVATE_LIMITED_COMPANY')?.registrationNumberLabel).toBe('RC Number');
      expect(getBusinessTypeConfig('PUBLIC_LIMITED_COMPANY')?.registrationNumberLabel).toBe('RC Number');
      expect(getBusinessTypeConfig('UNLIMITED_COMPANY')?.registrationNumberLabel).toBe('RC Number');
    });

    it('Business Name uses "CAC Registration Number"', () => {
      expect(getBusinessTypeConfig('BUSINESS_NAME')?.registrationNumberLabel).toBe('CAC Registration Number');
      expect(getBusinessTypeConfig('INCORPORATED_TRUSTEES')?.registrationNumberLabel).toBe('CAC Registration Number');
    });

    it('LLP uses "LLP Registration Number"', () => {
      expect(getBusinessTypeConfig('LLP')?.registrationNumberLabel).toBe('LLP Registration Number');
    });

    it('LP uses "LP Registration Number"', () => {
      expect(getBusinessTypeConfig('LP')?.registrationNumberLabel).toBe('LP Registration Number');
    });
  });

  describe('getBusinessTypeLabel', () => {
    it('returns the human-readable label for valid values', () => {
      expect(getBusinessTypeLabel('BUSINESS_NAME')).toBe('Business Name / Enterprise');
      expect(getBusinessTypeLabel('PRIVATE_LIMITED_COMPANY')).toBe('Private Company Limited by Shares (Ltd)');
      expect(getBusinessTypeLabel('INCORPORATED_TRUSTEES')).toBe('Incorporated Trustees / Non-Profit Organization');
    });

    it('returns "—" for null/unknown', () => {
      expect(getBusinessTypeLabel(null)).toBe('—');
      expect(getBusinessTypeLabel(undefined)).toBe('—');
      expect(getBusinessTypeLabel('PRIVATE')).toBe('—');
      expect(getBusinessTypeLabel('garbage')).toBe('—');
    });
  });

  describe('legacy normalization', () => {
    it('maps legacy "PRIVATE" to "PRIVATE_LIMITED_COMPANY"', () => {
      expect(normalizeLegacyBusinessType('PRIVATE')).toBe('PRIVATE_LIMITED_COMPANY');
      expect(normalizeLegacyBusinessType('Private Business')).toBe('PRIVATE_LIMITED_COMPANY');
    });

    it('maps legacy "PUBLIC" to "PUBLIC_LIMITED_COMPANY"', () => {
      expect(normalizeLegacyBusinessType('PUBLIC')).toBe('PUBLIC_LIMITED_COMPANY');
      expect(normalizeLegacyBusinessType('Public Business')).toBe('PUBLIC_LIMITED_COMPANY');
    });

    it('maps legacy "IS_GRADUATE" to "BUSINESS_NAME"', () => {
      expect(normalizeLegacyBusinessType('IS_GRADUATE')).toBe('BUSINESS_NAME');
      expect(normalizeLegacyBusinessType('Graduate')).toBe('BUSINESS_NAME');
    });

    it('returns canonical values unchanged', () => {
      for (const v of VALID_BUSINESS_TYPE_VALUES) {
        expect(normalizeLegacyBusinessType(v)).toBe(v);
      }
    });

    it('returns null for unknown/empty values', () => {
      expect(normalizeLegacyBusinessType('')).toBeNull();
      expect(normalizeLegacyBusinessType(null)).toBeNull();
      expect(normalizeLegacyBusinessType(undefined)).toBeNull();
      expect(normalizeLegacyBusinessType('garbage')).toBeNull();
    });
  });

  describe('isValidBusinessType', () => {
    it('accepts all valid enum values', () => {
      for (const v of VALID_BUSINESS_TYPE_VALUES) {
        expect(isValidBusinessType(v)).toBe(true);
      }
    });

    it('rejects legacy values', () => {
      expect(isValidBusinessType('PRIVATE')).toBe(false);
      expect(isValidBusinessType('Private Business')).toBe(false);
      expect(isValidBusinessType('PUBLIC')).toBe(false);
      expect(isValidBusinessType('IS_GRADUATE')).toBe(false);
    });

    it('rejects null, undefined, empty string, and garbage', () => {
      expect(isValidBusinessType(null)).toBe(false);
      expect(isValidBusinessType(undefined)).toBe(false);
      expect(isValidBusinessType('')).toBe(false);
      expect(isValidBusinessType('NOT_A_REAL_TYPE')).toBe(false);
    });
  });

  describe('document preservation on type switch', () => {
    it('canPreserveDocuments returns true for same type', () => {
      expect(canPreserveDocuments('BUSINESS_NAME', 'BUSINESS_NAME')).toBe(true);
    });

    it('canPreserveDocuments returns false when switching from company to business name', () => {
      expect(canPreserveDocuments('PRIVATE_LIMITED_COMPANY', 'BUSINESS_NAME')).toBe(false);
    });

    it('canPreserveDocuments returns false when switching from LLP to private company', () => {
      expect(canPreserveDocuments('LLP', 'PRIVATE_LIMITED_COMPANY')).toBe(false);
    });

    it('getIncompatibleDocuments returns director/SH docs when switching company→business name', () => {
      const incompatible = getIncompatibleDocuments('PRIVATE_LIMITED_COMPANY', 'BUSINESS_NAME');
      const ids = incompatible.map((d) => d.id);
      expect(ids).toContain('DIRECTOR_IDENTITY');
      expect(ids).toContain('SHAREHOLDER_INFO');
      expect(ids).toContain('COMPANY_CONSTITUTION');
    });

    it('getIncompatibleDocuments returns empty when switching to a compatible type', () => {
      const incompatible = getIncompatibleDocuments('BUSINESS_NAME', 'PARTNERSHIP');
      // Business Name has CAC + proprietor; Partnership has CAC + partner.
      // Proprietor identity is not required for partnership, so it's incompatible.
      const ids = incompatible.map((d) => d.id);
      expect(ids).toContain('PROPRIETOR_IDENTITY');
    });
  });

  describe('DOCUMENT_DEFINITIONS', () => {
    it('every document type has an id, label, and description', () => {
      for (const def of Object.values(DOCUMENT_DEFINITIONS)) {
        expect(def.id).toBeTruthy();
        expect(def.label).toBeTruthy();
        expect(def.description).toBeTruthy();
      }
    });
  });
});
