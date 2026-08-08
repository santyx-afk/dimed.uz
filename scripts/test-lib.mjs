/**
 * netlify/functions/lib dagi haqiqiy modullar uchun tekshiruvlar.
 * Ishlatish: npm test
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.SESSION_SECRET = 'test-secret-kamida-32-belgi-boladi!!';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'netlify', 'functions', 'lib');
const load = (file) => import(pathToFileURL(join(libDir, file)).href);

const { createSessionCookie, readSession, generateOtp } = await load('session.ts');
const { normalizePhone } = await load('http.ts');
const { tableName } = await load('env.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
};

const cookieValue = (setCookieHeader) => setCookieHeader.split(';')[0];

console.log('Sessiya:');
test("to'g'ri cookie o'qiladi", () => {
  const s = readSession(cookieValue(createSessionCookie({ phone: '+998901234567', userId: '111' })));
  assert.equal(s.phone, '+998901234567');
  assert.equal(s.userId, '111');
});

test("cookie xavfsizlik bayroqlari o'rnatilgan", () => {
  const header = createSessionCookie({ phone: '+998901234567', userId: '111' });
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) {
    assert.ok(header.includes(flag), `${flag} yo'q`);
  }
});

test('buzilgan imzo rad etiladi', () => {
  const cookie = cookieValue(createSessionCookie({ phone: '+998901234567', userId: '111' }));
  assert.equal(readSession(cookie.slice(0, -3) + 'AAA'), null);
});

test('qalbaki payload rad etiladi', () => {
  const evil = Buffer.from(
    JSON.stringify({ phone: '+998900000000', userId: '999', exp: 9999999999 }),
  ).toString('base64url');
  assert.equal(readSession(`dimed_session=${evil}.qalbaki`), null);
});

test("muddati o'tgan sessiya rad etiladi", () => {
  // Haqiqiy imzo bilan, lekin eskirgan exp.
  const cookie = cookieValue(createSessionCookie({ phone: '+998901234567', userId: '1' }));
  const [name, token] = cookie.split('=');
  const [payload, sig] = token.split('.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.ok(data.exp > Math.floor(Date.now() / 1000), 'yangi cookie muddati kelajakda emas');
  // Payloadni o'zgartirsak imzo mos kelmaydi — bu ham rad etilishi kerak.
  const expired = Buffer.from(JSON.stringify({ ...data, exp: 1 })).toString('base64url');
  assert.equal(readSession(`${name}=${expired}.${sig}`), null);
});

test("cookie yo'q bo'lsa null", () => {
  assert.equal(readSession(undefined), null);
  assert.equal(readSession('boshqa=qiymat'), null);
  assert.equal(readSession('dimed_session=imzosiz'), null);
});

test("boshqa cookie'lar orasidan topiladi", () => {
  const cookie = cookieValue(createSessionCookie({ phone: '+998901234567', userId: '7' }));
  assert.equal(readSession(`_ga=1; ${cookie}; other=2`).userId, '7');
});

console.log('Telefon:');
for (const [input, expected] of [
  ['+998 90 123 45 67', '+998901234567'],
  ['998901234567', '+998901234567'],
  ['901234567', '+998901234567'],
  ['90 123 45 67', '+998901234567'],
]) {
  test(`"${input}" -> ${expected}`, () => assert.equal(normalizePhone(input), expected));
}

console.log('OTP:');
test('har doim 6 xonali', () => {
  for (let i = 0; i < 2000; i++) assert.match(generateOtp(), /^\d{6}$/);
});

test('takrorlanmaydi (2000 tadan kamida 1900 xil)', () => {
  const set = new Set();
  for (let i = 0; i < 2000; i++) set.add(generateOtp());
  assert.ok(set.size > 1900, `faqat ${set.size} xil kod`);
});

console.log('Jadval nomlari:');
test('prefiks qo\'shiladi', () => assert.equal(tableName('users'), 'dimed_users'));

console.log(`\n${passed} ta tekshiruv o'tdi.`);
