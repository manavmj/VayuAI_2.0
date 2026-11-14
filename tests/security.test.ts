import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import {
  checkLoginLockout,
  clearFailedLogin,
  hashPasswordScrypt,
  isValidEmail,
  isValidRole,
  recordFailedLogin,
  sanitizeTextInput,
  signSessionToken,
  validatePasswordStrength,
  verifyPasswordScrypt,
  verifySessionToken,
} from '../server/security.ts';

test('scrypt password hashing uses unique salts and constant-time verification', () => {
  const hash1 = hashPasswordScrypt('CivicAir#2026');
  const hash2 = hashPasswordScrypt('CivicAir#2026');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPasswordScrypt('CivicAir#2026', hash1), true);
  assert.equal(verifyPasswordScrypt('WrongPass#2026', hash1), false);
});

test('HMAC-SHA256 session tokens verify cleanly and reject tampered payloads', () => {
  const token = signSessionToken({
    id: 'usr-123',
    name: 'Ward Lead',
    organization: 'Ward 14',
    email: 'lead@vayu.civic',
    role: 'ward_officer',
    createdAt: new Date().toISOString(),
  });

  const verified = verifySessionToken(token);
  assert.equal(verified?.email, 'lead@vayu.civic');
  assert.equal(verified?.role, 'ward_officer');

  const [payloadPart, sigPart] = token.split('.');
  const tampered = `${payloadPart}x.${sigPart}`;
  assert.equal(verifySessionToken(tampered), null);
});

test('password policy, email validation, role validation, and text sanitization enforce rules', () => {
  assert.ok(validatePasswordStrength('short'));
  assert.ok(validatePasswordStrength('alllowercase1'));
  assert.ok(validatePasswordStrength('NoNumberOrSymbol'));
  assert.equal(validatePasswordStrength('StrongPass1!'), null);

  assert.equal(isValidEmail('officer@ward.org'), true);
  assert.equal(isValidEmail('bad-email'), false);
  assert.equal(isValidRole('school'), true);
  assert.equal(isValidRole('superuser' as unknown), false);
  assert.equal(sanitizeTextInput('  Hello\n\tWorld\u0000 ', 50), 'Hello World');
});

test('brute-force tracker locks out after 5 consecutive failed logins and clears on success', () => {
  const mockReq = {
    ip: '127.0.0.99',
    headers: {},
  } as unknown as Request;

  clearFailedLogin(mockReq, 'locktest@vayu.civic', 'school');
  for (let i = 1; i <= 4; i += 1) {
    const res = recordFailedLogin(mockReq, 'locktest@vayu.civic', 'school');
    assert.equal(res.lockedOut, false);
    assert.equal(res.remainingAttempts, 5 - i);
  }
  const fifth = recordFailedLogin(mockReq, 'locktest@vayu.civic', 'school');
  assert.equal(fifth.lockedOut, true);
  assert.equal(checkLoginLockout(mockReq, 'locktest@vayu.civic', 'school').locked, true);

  clearFailedLogin(mockReq, 'locktest@vayu.civic', 'school');
  assert.equal(checkLoginLockout(mockReq, 'locktest@vayu.civic', 'school').locked, false);
});
