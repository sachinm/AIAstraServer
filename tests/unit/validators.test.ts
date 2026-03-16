import { describe, it, expect } from 'vitest';
import {
  validateLoginInput,
  validateSignUpInput,
} from '../../src/lib/validators.js';

describe('validators', () => {
  describe('validateLoginInput', () => {
    it('accepts valid username and password', () => {
      const result = validateLoginInput({ username: 'u1', password: 'pass123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('u1');
        expect(result.data.password).toBe('pass123');
      }
    });

    it('rejects empty username', () => {
      const result = validateLoginInput({ username: '', password: 'pass' });
      expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
      const result = validateLoginInput({ username: 'u', password: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('validateSignUpInput', () => {
    it('accepts valid signup input', () => {
      const result = validateSignUpInput({
        username: 'u1',
        password: 'pass1234',
        email: 'u1@test.com',
        date_of_birth: '1990-01-01',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('u1');
        expect(result.data.email).toBe('u1@test.com');
      }
    });

    it('rejects short password', () => {
      const result = validateSignUpInput({
        username: 'u1',
        password: 'short',
        email: 'u1@test.com',
        date_of_birth: '1990-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = validateSignUpInput({
        username: 'u1',
        password: 'pass1234',
        email: 'not-an-email',
        date_of_birth: '1990-01-01',
      });
      expect(result.success).toBe(false);
    });
  });
});
