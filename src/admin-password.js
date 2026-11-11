const crypto = require('node:crypto');

/** Verify a password against a `saltHex:derivedKeyHex` scrypt value. */
function verifyAdminPassword(candidate, stored) {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 256) return false;
  if (typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(candidate, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { verifyAdminPassword };
