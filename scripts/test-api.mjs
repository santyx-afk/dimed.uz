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
process.env.ADMIN_TELEGRAM_IDS = '424242';

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
const reschedule = await load('reschedule.ts');
const doctorOff = await load('doctor-off.ts');
const remindPatients = await load('remind-patients.ts');
const doctorDaily = await load('doctor-daily.ts');
const doctorsList = await load('doctors.ts');
const adminDoctors = await load('admin-doctors.ts');

const { toTashkent, toInstant, addDays } = await import(
  pathToFileURL(join(fnDir, 'lib', 'time.ts')).href
);
const { toHHMM } = await import(pathToFileURL(join(fnDir, 'lib', 'slots.ts')).href);

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
/*
  Bron stsenariylari uchun sana. Toshkent kalendari bo'yicha olinadi —
  kun kalitlari ham shunday hisoblanadi, UTC bo'yicha olinsa kechqurun
  (Toshkentda 19:00 dan keyin) sana bir kunga adashardi.

  Ikki kun oldinga: eslatma testi «hozirdan 30 daqiqa keyin» yozuv
  qo'yadi, Toshkentda yarim tunga yaqin u ertangi kunga tushib qolardi
  va «shifokor chiqmadi» testi ikkita navbatni bekor qilib yuborardi.
*/
const BOOK_DATE = addDays(toTashkent(new Date()).dateKey, 2);

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
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.slots.length, 8);
  assert.equal(data.slots.every((s) => s.free), true);
});

await test('noma\'lum shifokor 404', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=yoq&date=${BOOK_DATE}`);
  assert.equal(res.status, 404);
});

await test('noto\'g\'ri sana rad etiladi', async () => {
  const res = await call(slots, 'https://dimed.uz/api/slots?doctor=ashurov&date=12.08.2026');
  assert.equal(res.status, 400);
});

await test('javobda shifokorning ish kunlari qaytadi', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`);
  const data = await res.json();
  assert.deepEqual(data.workdays, [0, 1, 2, 3, 4, 5, 6]);
});

await test('shifokor kunni olib tashlasa, ish kunlari yangilangan holda qaytadi', async () => {
  /*
    Vidjetdagi kun tugmalari statik ma'lumotdan qurilardi. Endi ular
    shu maydonga qarab tuzatiladi, shuning uchun bazadagi o'zgarish
    javobda ko'rinishi shart.
  */
  const weekday = new Date(`${BOOK_DATE}T00:00:00Z`).getUTCDay();
  const full = [0, 1, 2, 3, 4, 5, 6];
  const without = full.filter((d) => d !== weekday);

  const doctor = tableOf('test_doctors').get('ashurov');
  seed('test_doctors', 'ashurov', { ...doctor, workdays: without });
  const data = await (
    await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`)
  ).json();
  seed('test_doctors', 'ashurov', doctor); // keyingi testlar to'liq jadvalga tayanadi

  assert.equal(data.reason, 'dam olish kuni');
  assert.deepEqual(data.slots, []);
  assert.deepEqual(data.workdays, without);
});

console.log('\nBron:');
await test('kirmagan foydalanuvchi bron qila olmaydi', async () => {
  const res = await call(
    book,
    'https://dimed.uz/api/book',
    jsonBody({ doctor: 'ashurov', date: BOOK_DATE, time: '09:00' }),
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
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00',
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.mode, 'at_clinic');
  const appt = tableOf('test_appointments').get(`ashurov#${BOOK_DATE}|09:00`);
  assert.equal(appt.status, 'booked', 'klinikada to\'lash — darhol band');
  assert.equal(appt.hold_until, undefined, 'bunda hold muddati bo\'lmasligi kerak');
  assert.ok(telegramCalls.some((c) => c.body.text.includes('band qilindi')));
});

await test('band slot ikkinchi marta olinmaydi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00',
  }));
  assert.equal(res.status, 409);
});

await test('band slot ro\'yxatda yopiq ko\'rinadi', async () => {
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`);
  const data = await res.json();
  assert.equal(data.slots.find((s) => s.time === '09:00').free, false);
  assert.equal(data.slots.find((s) => s.time === '10:00').free, true);
});

await test('jadvalda yo\'q vaqt rad etiladi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: BOOK_DATE, time: '12:30',
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
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`);
  const data = await res.json();
  assert.equal(data.slotMinutes, 30);
  assert.equal(data.slots[0].time, '09:00');
  assert.ok(!data.slots.some((s) => s.time === '08:00'), 'eski smena qolmasin');
});

await test('band qilingan navbat jadval o\'zgarsa ham saqlanadi', async () => {
  const appt = tableOf('test_appointments').get(`ashurov#${BOOK_DATE}|09:00`);
  assert.equal(appt.status, 'booked');
  const res = await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`);
  const data = await res.json();
  assert.equal(data.slots.find((s) => s.time === '09:00').free, false, 'band navbat band qolishi kerak');
});

console.log('\nVaqtni ko\'chirish:');
const move = (obj) => ({ ...jsonBody(obj), headers: { 'content-type': 'application/json', cookie: sessionCookie } });

await test('kirmagan foydalanuvchi ko\'chira olmaydi', async () => {
  const res = await call(reschedule, 'https://dimed.uz/api/reschedule', jsonBody({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00', toDate: BOOK_DATE, toTime: '10:00',
  }));
  assert.equal(res.status, 401);
});

await test('begona qabulni ko\'chirib bo\'lmaydi', async () => {
  const other = createSessionCookie({ phone: '+998911111111', userId: '9001' }).split(';')[0];
  const res = await call(reschedule, 'https://dimed.uz/api/reschedule', {
    ...jsonBody({ doctor: 'ashurov', date: BOOK_DATE, time: '09:00', toDate: BOOK_DATE, toTime: '10:00' }),
    headers: { 'content-type': 'application/json', cookie: other },
  });
  assert.equal(res.status, 403);
});

await test('o\'sha vaqtning o\'ziga ko\'chirib bo\'lmaydi', async () => {
  const res = await call(reschedule, 'https://dimed.uz/api/reschedule', move({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00', toDate: BOOK_DATE, toTime: '09:00',
  }));
  assert.equal(res.status, 400);
});

await test('jadvalda yo\'q vaqtga ko\'chirib bo\'lmaydi', async () => {
  const res = await call(reschedule, 'https://dimed.uz/api/reschedule', move({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00', toDate: BOOK_DATE, toTime: '12:30',
  }));
  assert.equal(res.status, 400);
});

await test('qabul boshqa vaqtga ko\'chadi va botga xabar ketadi', async () => {
  telegramCalls.length = 0;
  const res = await call(reschedule, 'https://dimed.uz/api/reschedule', move({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00', toDate: BOOK_DATE, toTime: '10:00',
  }));
  assert.equal(res.status, 200);

  const table = tableOf('test_appointments');
  assert.equal(table.get(`ashurov#${BOOK_DATE}|09:00`).status, 'moved', 'eski yozuv moved bo\'lishi kerak');

  const moved = table.get(`ashurov#${BOOK_DATE}|10:00`);
  assert.equal(moved.status, 'booked');
  assert.equal(moved.phone, '+998901234567');
  assert.equal(moved.moved_from, `${BOOK_DATE} 09:00`);
  assert.equal(moved.reminded_at, undefined, 'yangi vaqt uchun eslatma qaytadan yuborilishi kerak');
  assert.ok(telegramCalls.some((c) => c.body.text.includes('o\'zgartirildi')));
});

await test('eski slot bo\'shaydi, yangisi band bo\'ladi', async () => {
  const data = await (await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`)).json();
  assert.equal(data.slots.find((s) => s.time === '09:00').free, true);
  assert.equal(data.slots.find((s) => s.time === '10:00').free, false);
});

await test('ko\'chirilgan yozuvni qayta ko\'chirib bo\'lmaydi', async () => {
  const res = await call(reschedule, 'https://dimed.uz/api/reschedule', move({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00', toDate: BOOK_DATE, toTime: '11:00',
  }));
  assert.equal(res.status, 400);
});

await test('kabinetda faqat yangi vaqt ko\'rinadi', async () => {
  const data = await (await call(me, 'https://dimed.uz/api/me', { headers: { cookie: sessionCookie } })).json();
  assert.equal(data.appointments.length, 1);
  assert.equal(data.appointments[0].time, '10:00');
  assert.equal(data.appointments[0].canMove, true);
});

console.log('\nEslatmalar:');
// Bron API'si 1 soat qoidasi sababli bunday yozuvni yarata olmaydi,
// shuning uchun eslatma uchun yozuvni to'g'ridan-to'g'ri qo'yamiz.
const soon = toTashkent(new Date(Date.now() + 30 * 60_000));
const SOON_DATE = soon.dateKey;
const SOON_TIME = toHHMM(soon.minutes);
const TODAY = toTashkent(new Date()).dateKey;

seed('test_appointments', `ashurov#${SOON_DATE}|${SOON_TIME}`, {
  doctor_day: `ashurov#${SOON_DATE}`,
  time: SOON_TIME,
  doctor_id: 'ashurov',
  date: SOON_DATE,
  phone: '+998901234567',
  telegram_id: '777',
  starts_at: toInstant(SOON_DATE, SOON_TIME).toISOString(),
  status: 'booked',
  price: 70000,
  created_at: new Date().toISOString(),
});

await test('bir soat qolganda bemorga eslatma ketadi', async () => {
  telegramCalls.length = 0;
  const res = await call(remindPatients, 'https://dimed.uz/api/remind-patients', { method: 'POST' });
  assert.equal(res.status, 200);

  assert.ok(
    telegramCalls.some((c) => c.body.chat_id === '777' && c.body.text.includes(SOON_TIME)),
    'eslatma xabari yuborilishi kerak',
  );
  assert.ok(tableOf('test_appointments').get(`ashurov#${SOON_DATE}|${SOON_TIME}`).reminded_at);
});

await test('eslatma ikkinchi marta yuborilmaydi', async () => {
  telegramCalls.length = 0;
  await call(remindPatients, 'https://dimed.uz/api/remind-patients', { method: 'POST' });
  assert.equal(telegramCalls.length, 0, 'takroriy eslatma bo\'lmasligi kerak');
});

await test('ertaga bo\'ladigan qabulga hozir eslatma yuborilmaydi', async () => {
  assert.equal(tableOf('test_appointments').get(`ashurov#${BOOK_DATE}|10:00`).reminded_at, undefined);
});

console.log('\nShifokorga kunlik xulosa:');
// Bugungi kunda albatta bitta navbat bo'lishi uchun (yuqoridagi
// yozuv yarim tundan keyinga tushib qolishi mumkin).
seed('test_appointments', `ashurov#${TODAY}|06:00`, {
  doctor_day: `ashurov#${TODAY}`,
  time: '06:00',
  doctor_id: 'ashurov',
  date: TODAY,
  phone: '+998901234567',
  telegram_id: '777',
  starts_at: toInstant(TODAY, '06:00').toISOString(),
  status: 'booked',
  price: 70000,
  created_at: new Date().toISOString(),
});

await test('shifokor bugungi navbatlari ro\'yxatini oladi', async () => {
  telegramCalls.length = 0;
  const res = await call(doctorDaily, 'https://dimed.uz/api/doctor-daily', { method: 'POST' });
  assert.equal(res.status, 200);

  const message = telegramCalls.find((c) => c.body.chat_id === '555');
  assert.ok(message, 'shifokorga xabar ketishi kerak');
  assert.ok(message.body.text.includes('Bugungi navbatlaringiz'));
  assert.ok(message.body.text.includes('06:00'));
  assert.ok(!message.body.text.includes('+998901234567'), 'raqam to\'liq ko\'rsatilmasligi kerak');
});

await test('kunlik xulosa bir kunda bir marta ketadi', async () => {
  telegramCalls.length = 0;
  await call(doctorDaily, 'https://dimed.uz/api/doctor-daily', { method: 'POST' });
  assert.equal(telegramCalls.length, 0, 'takroriy xulosa bo\'lmasligi kerak');
});

console.log('\nShifokor ishga chiqolmadi:');
await test('bemor bu tugmani bosa olmaydi', async () => {
  const res = await call(doctorOff, 'https://dimed.uz/api/doctor-off', move({ date: BOOK_DATE }));
  assert.equal(res.status, 403);
});

await test('o\'tgan kunni yopib bo\'lmaydi', async () => {
  const res = await call(doctorOff, 'https://dimed.uz/api/doctor-off', {
    ...jsonBody({ date: '2020-01-01' }),
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
  });
  assert.equal(res.status, 400);
});

await test('kun yopiladi va bemorlarga xabar boradi', async () => {
  telegramCalls.length = 0;
  const res = await call(doctorOff, 'https://dimed.uz/api/doctor-off', {
    ...jsonBody({ date: BOOK_DATE, reason: 'Kasal bo\'lib qoldim' }),
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
  });
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.cancelled, 1, 'o\'sha kundagi bitta navbat bekor qilinishi kerak');
  assert.equal(data.notified, 1);

  assert.equal(tableOf('test_appointments').get(`ashurov#${BOOK_DATE}|10:00`).status, 'cancelled_by_clinic');
  assert.ok(telegramCalls.some((c) => c.body.text.includes('Kasal bo\'lib qoldim')));
});

await test('bemor kabinetda bekor qilinganini ko\'radi', async () => {
  const data = await (await call(me, 'https://dimed.uz/api/me', { headers: { cookie: sessionCookie } })).json();
  const cancelled = data.appointments.find((a) => a.date === BOOK_DATE);
  assert.equal(cancelled.status, 'cancelled_by_clinic');
  assert.equal(cancelled.canMove, false, 'bekor qilinganini ko\'chirib bo\'lmaydi');
});

await test('yopilgan kunda slot qolmaydi', async () => {
  const data = await (await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`)).json();
  assert.equal(data.slots.length, 0);
});

await test('dam olish kuni belgilansa slot qolmaydi', async () => {
  const res = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: doctorCookie },
    body: JSON.stringify({ date: BOOK_DATE, dayOff: true }),
  });
  assert.equal(res.status, 200);

  const after = await (await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${BOOK_DATE}`)).json();
  assert.equal(after.slots.length, 0);
});

// ================= Admin panel =================
const adminCookie = createSessionCookie({ phone: '+998900424242', userId: '424242' }).split(';')[0];

console.log('\nAdmin panel:');

await test('GET /api/doctors faol shifokorlarni qaytaradi', async () => {
  const res = await call(doctorsList, 'https://dimed.uz/api/doctors');
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list));
  const a = list.find((d) => d.id === 'ashurov');
  assert.ok(a, 'ashurov ro\'yxatda bo\'lishi kerak');
  assert.equal(a.deptId, 'terapiya', 'dept_id → deptId ko\'chirilgan');
  assert.equal(a.telegramId, undefined, 'telegram_id public javobda chiqmasligi kerak');
});

await test('admin-doctors sessiyasiz 401', async () => {
  const res = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors');
  assert.equal(res.status, 401);
});

await test('oddiy bemorga 403 va o\'z Telegram ID si qaytadi', async () => {
  const res = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    headers: { cookie: sessionCookie },
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.telegramId, '777', 'egasi o\'z ID sini bilishi uchun');
});

await test('admin barcha shifokorlarni ko\'radi', async () => {
  const res = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    headers: { cookie: adminCookie },
  });
  assert.equal(res.status, 200);
  const { doctors } = await res.json();
  assert.ok(doctors.find((d) => d.id === 'ashurov'));
});

await test('admin yangi shifokor qo\'shadi va u /api/doctors da ko\'rinadi', async () => {
  const res = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      id: 'yangidoc',
      name: 'Yangi Shifokor',
      job: 'Dermatolog',
      deptId: 'terapiya',
      price: 55000,
      slotMinutes: 20,
      workdays: [1, 2, 3],
      shifts: [{ start: '09:00', end: '13:00' }],
    }),
  });
  assert.equal(res.status, 200);

  const list = await (await call(doctorsList, 'https://dimed.uz/api/doctors')).json();
  assert.ok(list.find((d) => d.id === 'yangidoc'), 'yangi shifokor public ro\'yxatda');
});

await test('admin noto\'g\'ri bo\'lim va slotni rad etadi', async () => {
  const badDept = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      id: 'yomon', name: 'X', job: 'Y', deptId: 'yoqdept',
      price: 1000, slotMinutes: 20, workdays: [1], shifts: [{ start: '09:00', end: '10:00' }],
    }),
  });
  assert.equal(badDept.status, 400);

  const badSlot = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      id: 'yomon2', name: 'X', job: 'Y', deptId: 'terapiya',
      price: 1000, slotMinutes: 7, workdays: [1], shifts: [{ start: '09:00', end: '10:00' }],
    }),
  });
  assert.equal(badSlot.status, 400);
});

await test('bitta Telegram ID ni ikki shifokorga bog\'lab bo\'lmaydi', async () => {
  // ashurov ning telegram_id si '555'. Uni yangidoc ga bog'lashga urinamiz.
  const res = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      id: 'yangidoc', name: 'Yangi Shifokor', job: 'Dermatolog', deptId: 'terapiya',
      price: 55000, slotMinutes: 20, workdays: [1, 2, 3],
      shifts: [{ start: '09:00', end: '13:00' }], telegramId: '555',
    }),
  });
  assert.equal(res.status, 400);
});

await test('admin shifokorni o\'chiradi — u faolsizlanadi', async () => {
  const res = await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ id: 'yangidoc' }),
  });
  assert.equal(res.status, 200);

  // /api/doctors da endi ko'rinmaydi
  const list = await (await call(doctorsList, 'https://dimed.uz/api/doctors')).json();
  assert.equal(list.find((d) => d.id === 'yangidoc'), undefined);

  // Admin ro'yxatida active:false bilan turadi (tarix saqlanadi)
  const { doctors } = await (
    await call(adminDoctors, 'https://dimed.uz/api/admin-doctors', { headers: { cookie: adminCookie } })
  ).json();
  const yd = doctors.find((d) => d.id === 'yangidoc');
  assert.ok(yd && yd.active === false, 'faolsiz holatda ro\'yxatda qoladi');
});

stopFakeDynamo();
console.log(`\n${passed} ta API tekshiruvi o'tdi.`);
