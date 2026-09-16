import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordPlaceholder, getPasswordError } from '../passwordValidation';

describe('passwordValidation', () => {
  describe('validatePassword', () => {
    it('rejects password shorter than 12 characters', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters');
    });

    it('rejects 11-character password', () => {
      const result = validatePassword('11CharPass!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters');
    });

    it('rejects password without uppercase letter', () => {
      const result = validatePassword('nouppercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects password without lowercase letter', () => {
      const result = validatePassword('NOLOWERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects password without number', () => {
      const result = validatePassword('NoNumberSymbol!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('rejects password without symbol', () => {
      const result = validatePassword('NoSymbol12345');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one symbol');
    });

    it('accepts valid password with all five requirements', () => {
      const result = validatePassword('ValidPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts password with mixed case, number, and symbol', () => {
      const result = validatePassword('MyP@ssw0rd123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports multiple missing requirements', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPasswordPlaceholder', () => {
    it('returns placeholder text describing all requirements', () => {
      const placeholder = getPasswordPlaceholder();
      expect(placeholder).toContain('12');
      expect(placeholder).toContain('A-Z');
      expect(placeholder).toContain('a-z');
      expect(placeholder).toContain('number');
      expect(placeholder).toContain('symbol');
    });
  });

  describe('getPasswordError', () => {
    it('returns error message describing all requirements', () => {
      const error = getPasswordError();
      expect(error).toContain('12');
      expect(error).toContain('uppercase');
      expect(error).toContain('lowercase');
      expect(error).toContain('number');
      expect(error).toContain('symbol');
    });
  });
});
