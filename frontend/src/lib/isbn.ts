// Pure ISBN/EAN-13 core. No IO, no deps.

export function ean13Checksum(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

export function isBookEan(raw: string): boolean {
  const digits = raw.replace(/[-\s]/g, '');
  if (!/^\d{13}$/.test(digits)) return false;
  if (!digits.startsWith('978') && !digits.startsWith('979')) return false;
  return ean13Checksum(digits);
}

function isbn10Checksum(digits: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  const last = digits[9].toUpperCase();
  sum += (last === 'X' ? 10 : Number(last)) * 1;
  return sum % 11 === 0;
}

function isbn10to13(isbn10: string): string {
  const core = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return core + check;
}

export function normalizeIsbn(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9Xx]/g, '');

  if (cleaned.length === 13 && isBookEan(cleaned)) {
    return cleaned;
  }

  if (cleaned.length === 10 && isbn10Checksum(cleaned)) {
    return isbn10to13(cleaned);
  }

  return null;
}
