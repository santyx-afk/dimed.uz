/**
 * API funksiyalarini haqiqiy HTTP so'rovlari bilan tekshiradi.
 *
 * DynamoDB, S3 va Telegram o'rniga xotiradagi soxta xizmatlar ishlatiladi:
 * AWS SDK ning "endpoint" sozlamasi orqali lokal serverga yo'naltiriladi,
 * global fetch esa Telegram chaqiruvlarini ushlab qoladi.
 *
 * Ishlatish: npm run test:api
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fnDir = join(root, 'netlify', 'functions');

// --- muhit ---
process.env.SESSION_SECRET = 'test-secret-kamida-32-belgi-boladi!!';
process.env.DIMED_TABLE_PREFIX = 'test';
process.env.DIMED_AWS_REGION = 'eu-central-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_WEBHOOK_SECRET = 'webhook-secret';
process.env.LC_API_KEY = 'lc-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'pay-secret';

import { startFakeDynamo, stopFakeDynamo, seed, tableOf } from './fake-dynamo.mjs';

process.env.DIMED_DYNAMO_ENDPOINT = await startFakeDynamo();

// --- Telegram chaqiruvlarini ushlash ---
const telegramCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes('api.telegram.org')) {
    telegramCalls.push({ url, body: JSON.parse(init?.body ?? '{}') });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  return realFetch(input, init);
};

// --- yuklash ---
const load = (name) => import(pathToFileURL(join(fnDir, name)).href).then((m) => m.default);
const { createSessionCookie } = await import(
  pathToFileURL(join(fnDir, 'lib', 'session.ts')).href
);

const telegramWebhook = await load('telegram-webhook.ts');
const authVerify = await load('auth-verify.ts');
const slots = await load('slots.ts');
const book = await load('book.ts');
const me = await load('me.ts');
const doctorSchedule = await load('doctor-schedule.ts');
const lcResults = await load('lc-results.ts');

const ctx = {};
const call = (fn, url, init) => fn(new Request(url, init), ctx);
const jsonBody = (obj) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(obj),
});

let passed = 0;
const test = async (name, fn) => {
  await fn();
  console.log(`  ok  ${name}`);
  passed++;
};

// --- ma'lumot tayyorlash ---
const TOMORROW = (() => {
  const d = new Date(Date.now() + 24 * 3600_000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
})();

seed('test_doctors', 'ashurov', {
  doctor_id: 'ashurov',
  name: 'Ashurov Tursunali',
  job: 'Terapevt',
  dept_id: 'terapiya',
  telegram_id: '555',
  slot_minutes: 60,
  shifts: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
  workdays: [0, 1, 2, 3, 4, 5, 6],
  price: 70000,
  active: true,
});

console.log('Telegram bot va OTP:');
await test('webhook noto\'g\'ri secret bilan rad etiladi', async () => {
  const res = await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({ message: { chat: { id: 1 }, text: '/start' } }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'yolgon' },
  });
  assert.equal(res.status, 401);
});

await test('kontakt yuborilganda foydalanuvchi va OTP yaratiladi', async () => {
  telegramCalls.length = 0;
  const res = await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({
      message: { chat: { id: 777 }, contact: { phone_number: '998901234567', first_name: 'Aziza' } },
    }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });
  assert.equal(res.status, 200);
  assert.equal(tableOf('test_users').get('777').phone, '+998901234567');
  const otp = tableOf('test_otp_codes').get('+998901234567');
  assert.match(otp.code, /^\d{6}$/);
  assert.ok(telegramCalls.some((c) => c.body.text.includes(otp.code)), 'kod botga yuborilishi kerak');
});

await test('noto\'g\'ri kod rad etiladi', async () => {
  const res = await call(
    authVerify,
    'https://dimed.uz/api/auth-verify',
    jsonBody({ phone: '+998901234567', code: '000000' }),
  );
  assert.equal(res.status, 401);
});

let sessionCookie;
await test('to\'g\'ri kod sessiya beradi va kod bir martalik', async () => {
  const code = tableOf('test_otp_codes').get('+998901234567').code;
  const res = await call(
    authVerify,
    'https://dimed.uz/api/auth-verify',
    jsonBody({ phone: '+998901234567', code }),
  );
  assert.equal(res.status, 200);
  sessionCookie = res.headers.get('set-cookie').split(';')[0];
  assert.ok(sessionCookie.startsWith('dimed_session='));
  assert.equal(tableOf('test_otp_codes').has('+998901234567'), false, 'kod o\'chirilishi kerak');

  const again = await call(
    authVerify,
    'https://dimed.uz/api/auth-verify',
    jsonBody({ phone: '+998901234567', code }),
  );
  assert.equal(again.status, 401, 'ishlatilgan kod qayta o\'tmasligi kerak');
});

console.log('\nSlotlar:');
await test('slot ro\'yxati qaytadi', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${TOMORROW}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.slots.length, 8);
  assert.equal(data.slots.every((s) => s.free), true);
});

await test('noma\'lum shifokor 404', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=yoq&date=${TOMORROW}`);
  assert.equal(res.status, 404);
});

await test('noto\'g\'ri sana rad etiladi', async () => {
  const res = await call(slots, 'https://dimed.uz/api/slots?doctor=ashurov&date=12.08.2026');
  assert.equal(res.status, 400);
});

console.log('\nBron:');
await test('kirmagan foydalanuvchi bron qila olmaydi', async () => {
  const res = await call(
    book,
    'https://dimed.uz/api/book',
    jsonBody({ doctor: 'ashurov', date: TOMORROW, time: '09:00' }),
  );
  assert.equal(res.status, 401);
});

const authed = (obj) => ({
  ...jsonBody(obj),
  headers: { 'content-type': 'application/json', cookie: sessionCookie },
});

await test('bron qilinadi va botga tasdiq ketadi', async () => {
  telegramCalls.length = 0;
  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: TOMORROW, time: '09:00',
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.mode, 'at_clinic');
  const appt = tableOf('test_appointments').get(`ashurov#${TOMORROW}|09:00`);
  assert.equal(appt.status, 'booked', 'klinikada to\'lash — darhol band');
  assert.equal(appt.hold_until, undefined, 'bunda hold muddati bo\'lmasligi kerak');
  assert.ok(telegramCalls.some((c) => c.body.text.includes('band qilindi')));
});

await test('band slot ikkinchi marta olinmaydi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: TOMORROW, time: '09:00',
  }));
  assert.equal(res.status, 409);
});

await test('band slot ro\'yxatda yopiq ko\'rinadi', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${TOMORROW}`);
  const data = await res.json();
  assert.equal(data.slots.find((s) => s.time === '09:00').free, false);
  assert.equal(data.slots.find((s) => s.time === '10:00').free, true);
});

await test('jadvalda yo\'q vaqt rad etiladi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: TOMORROW, time: '12:30',
  }));
  assert.equal(res.status, 400);
});

await test('o\'tgan kunga bron qilib bo\'lmaydi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: '2020-01-01', time: '09:00',
  }));
  assert.equal(res.status, 400);
});

console.log('\nKabinet:');
await test('kirmagan foydalanuvchi 401 oladi', async () => {
  const res = await call(me, 'https://dimed.uz/api/me');
  assert.equal(res.status, 401);
});

await test('bemor o\'z qabulini ko\'radi', async () => {
  const res = await call(me, 'https://dimed.uz/api/me', { headers: { cookie: sessionCookie } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.appointments.length, 1);
  assert.equal(data.appointments[0].doctorName, 'Ashurov Tursunali');
  assert.equal(data.appointments[0].upcoming, true);
});

await test('1C natijasi kabinetda ko\'rinadi', async () => {
  const res = await call(lcResults, 'https://dimed.uz/api/lc-results', {
    ...jsonBody({
      phone: '+998901234567',
      results: [{ code: '96', title: 'Gemoglobin', value: '132 g/L', reference: '120 – 160' }],
    }),
    headers: { 'content-type': 'application/json', 'x-api-key': 'lc-secret' },
  });
  assert.equal(res.status, 200);

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();
  assert.equal(cabinet.results.length, 1);
  assert.equal(cabinet.results[0].title, 'Gemoglobin');
  assert.equal(cabinet.results[0].type, 'text');
});

await test('noto\'g\'ri API kalit bilan 1C rad etiladi', async () => {
  const res = await call(lcResults, 'https://dimed.uz/api/lc-results', {
    ...jsonBody({ phone: '+998901234567', results: [{ code: '1', title: 'X' }] }),
    headers: { 'content-type': 'application/json', 'x-api-key': 'yolgon' },
  });
  assert.equal(res.status, 401);
});

console.log('\nShifokor kabineti:');
await test('bemor shifokor kabinetiga kira olmaydi', async () => {
  const res = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule', {
    headers: { cookie: sessionCookie },
  });
  assert.equal(res.status, 403);
});

let doctorCookie;
await test('shifokor o\'z jadvalini va navbatini ko\'radi', async () => {
  doctorCookie = createSessionCookie({ phone: '+998900000555', userId: '555' }).split(';')[0];
  const res = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule', {
    headers: { cookie: doctorCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.doctor.name, 'Ashurov Tursunali');
  assert.equal(data.slots.length, 8);
});

await test('shifokor smenalari va slot davomiyligini o\'zgartiradi', async () => {
  const res = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({
      shifts: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
      slotMinutes: 30,
    }),
  });
  assert.equal(res.status, 200);
  const doctor = tableOf('test_doctors').get('ashurov');
  assert.equal(doctor.slot_minutes, 30);
  assert.equal(doctor.shifts[0].start, '09:00');
});

await test('ustma-ust smenalar rad etiladi', async () => {
  const res = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({
      shifts: [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '17:00' }],
    }),
  });
  assert.equal(res.status, 400);
});

await test('yangi jadval slotlarga darhol ta\'sir qiladi', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${TOMORROW}`);
  const data = await res.json();
  assert.equal(data.slotMinutes, 30);
  assert.equal(data.slots[0].time, '09:00');
  assert.ok(!data.slots.some((s) => s.time === '08:00'), 'eski smena qolmasin');
});

await test('band qilingan navbat jadval o\'zgarsa ham saqlanadi', async () => {
  const appt = tableOf('test_appointments').get(`ashurov#${TOMORROW}|09:00`);
  assert.equal(appt.status, 'booked');
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${TOMORROW}`);
  const data = await res.json();
  assert.equal(data.slots.find((s) => s.time === '09:00').free, false, 'band navbat band qolishi kerak');
});

await test('dam olish kuni belgilansa slot qolmaydi', async () => {
  const res = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({ date: TOMORROW, dayOff: true }),
  });
  assert.equal(res.status, 200);

  const after = await (await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${TOMORROW}`)).json();
  assert.equal(after.slots.length, 0);
});

stopFakeDynamo();
console.log(`\n${passed} ta API tekshiruvi o'tdi.`);
