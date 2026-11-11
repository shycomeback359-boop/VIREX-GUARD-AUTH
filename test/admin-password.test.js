const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyAdminPassword } = require('../src/admin-password');

function makeHash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

test('admin password verifier accepts the matching password', () => {
  const hash = makeHash('unit-test-only-password');
  assert.equal(verifyAdminPassword('unit-test-only-password', hash), true);
});

test('admin password verifier rejects a wrong password and malformed hashes', () => {
  const hash = makeHash('unit-test-only-password');
  assert.equal(verifyAdminPassword('wrong-password', hash), false);
  assert.equal(verifyAdminPassword('', hash), false);
  assert.equal(verifyAdminPassword('unit-test-only-password', 'not-a-hash'), false);
  assert.equal(verifyAdminPassword('unit-test-only-password', `${'z'.repeat(32)}:${'0'.repeat(128)}`), false);
});
