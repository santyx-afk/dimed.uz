/**
 * Telefon raqamini o'qish va tekshirish (src/lib/phone.ts).
 * Ishlatish: node --experimental-strip-types scripts/test-phone.mjs
 */
import assert from 'node:assert/strict';
import { parsePhone, normalizePhone, formatPhone, phoneVariants } from '../src/lib/phone.ts';

let passed = 0;
const test = (name, fn) => {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
};

console.log('Telefon raqami:');

test('odamlar yozadigan barcha formatlar bitta kalitga keladi', () => {
  const same = [
    '90 123 45 67',
    '901234567',
    '90 123 4567',
    '90-123-45-67',
    '(90) 123 45 67',
    '+998 90 123 45 67',
    '+998 90 123 4567',
    '+998901234567',
    '998901234567',
    '998 90 123 45 67',
    '00998901234567',
    '8 998 90 123 45 67',
    '  +998 (90) 123-45-67  ',
  ];
  for (const raw of same) {
    const res = parsePhone(raw);
    assert.equal(res.ok, true, `${raw} qabul qilinishi kerak edi`);
    assert.equal(res.value, '+998901234567', `${raw} → ${res.value}`);
  }
});

test('boshqa operator kodlari ham ishlaydi', () => {
  for (const [raw, want] of [
    ['11 111 11 11', '+998111111111'],
    ['+998 11 111 1111', '+998111111111'],
    ['111111111', '+998111111111'],
    ['33 555 00 11', '+998335550011'],
    ['+998 55 9009 103', '+998559009103'],
  ]) {
    const res = parsePhone(raw);
    assert.equal(res.ok, true, `${raw} qabul qilinishi kerak edi`);
    assert.equal(res.value, want);
  }
});

test('noto\'g\'ri raqam sababi bilan rad etiladi', () => {
  for (const raw of ['', '   ', '1', '123', '90 123 45', '9012345678', 'salom', '+998 0 123 45 67']) {
    const res = parsePhone(raw);
    assert.equal(res.ok, false, `${raw} rad etilishi kerak edi`);
    assert.ok(res.error.length > 5, 'sabab aytilishi kerak');
  }
});

test('ko\'rsatish uchun chiroyli formatlanadi', () => {
  assert.equal(formatPhone('+998901234567'), '+998 90 123 45 67');
  assert.equal(formatPhone('901234567'), '+998 90 123 45 67');
  assert.equal(formatPhone('buzuq'), 'buzuq');
});

test('bazadagi boshqa yozilishlar ro\'yxati', () => {
  const list = phoneVariants('+998901234567');
  assert.ok(list.includes('+998901234567'));
  assert.ok(list.includes('998901234567'), 'plyussiz variant');
  assert.ok(list.includes('901234567'), 'kodsiz variant');
  assert.equal(new Set(list).size, list.length, 'takrorlanmasin');
});

test('normalizePhone eski chaqiruvlarni buzmaydi', () => {
  assert.equal(normalizePhone('998901234567'), '+998901234567');
  assert.equal(normalizePhone('+998 90 123 45 67'), '+998901234567');
});

console.log(`\n${passed} ta tekshiruv o'tdi.`);
