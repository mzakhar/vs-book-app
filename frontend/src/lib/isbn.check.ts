import { ean13Checksum, isBookEan, normalizeIsbn } from './isbn';

// Frontend tsconfig has no @types/node (no other agent's file to add it to),
// so this stays a plain assert instead of `node:assert` to keep `tsc` clean.
function assertEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
const assert = { strictEqual: assertEqual };

// Valid ISBN-13 (checksum verified by hand: sum=90, check=0)
assert.strictEqual(isBookEan('9780553103540'), true, 'valid 978 EAN should be accepted');
assert.strictEqual(normalizeIsbn('9780553103540'), '9780553103540');

// Same digits, last digit corrupted -> bad checksum
assert.strictEqual(isBookEan('9780553103541'), false, 'corrupted checksum should be rejected');
assert.strictEqual(normalizeIsbn('9780553103541'), null);

// 12-digit UPC-A and 5-digit price add-on -> rejected
assert.strictEqual(isBookEan('036000291452'), false, '12-digit UPC-A should be rejected');
assert.strictEqual(normalizeIsbn('036000291452'), null);
assert.strictEqual(isBookEan('90000'), false, '5-digit price add-on should be rejected');
assert.strictEqual(normalizeIsbn('90000'), null);

// Valid 979-prefixed EAN (checksum computed: 9791234567896)
assert.strictEqual(isBookEan('9791234567896'), true, 'valid 979 EAN should be accepted');
assert.strictEqual(ean13Checksum('9791234567896'), true);

// ISBN-10 with 'X' check digit converts to the correct ISBN-13
// 080442957X (valid ISBN-10) -> 9780804429573
assert.strictEqual(normalizeIsbn('080442957X'), '9780804429573');
assert.strictEqual(normalizeIsbn('080442957x'), '9780804429573', 'lowercase x should also work');

// Hyphenated input normalizes
assert.strictEqual(normalizeIsbn('978-0-553-10354-0'), '9780553103540');
assert.strictEqual(normalizeIsbn('0-8044-2957-X'), '9780804429573');

// Garbage / empty string -> null
assert.strictEqual(normalizeIsbn(''), null);
assert.strictEqual(normalizeIsbn('not an isbn'), null);
assert.strictEqual(isBookEan(''), false);

console.log('isbn.check.ts OK');
