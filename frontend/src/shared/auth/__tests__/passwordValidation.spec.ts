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
      const result = validatePassword('11charpass!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters');
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

    it('accepts valid password with 12+ chars, number, and symbol', () => {
      const result = validatePassword('ValidPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts password with multiple errors listed', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPasswordPlaceholder', () => {
    it('returns placeholder text describing requirements', () => {
      const placeholder = getPasswordPlaceholder();
      expect(placeholder).toContain('12');
      expect(placeholder).toContain('number');
      expect(placeholder).toContain('symbol');
    });
  });

  describe('getPasswordError', () => {
    it('returns error message describing requirements', () => {
      const error = getPasswordError();
      expect(error).toContain('12');
      expect(error).toContain('number');
      expect(error).toContain('symbol');
    });
  });
});
