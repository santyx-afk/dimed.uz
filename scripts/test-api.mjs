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
process.env.PAYME_MERCHANT_ID = 'test-kassa';
process.env.PAYME_KEY = 'payme-secret';
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
const paymentWebhook = await load('payment-webhook.ts');
const patientsApi = await load('patients.ts');

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

await test('kontaktda 1C profili birlashadi (individuals jadvalidan)', async () => {
  seed('test_individuals', '+998907777777|1146', {
    phone: '+998907777777', sort_key: '1146',
    Surname: 'Toirov', Name: 'Rozimuhammad', IsMale: true,
    Birthday: '25.04.1990', PriceCategory: 'Asosiy',
  });
  const res = await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({
      message: { chat: { id: 888 }, contact: { phone_number: '998907777777', first_name: 'Rozi' } },
    }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });
  assert.equal(res.status, 200);
  const user = tableOf('test_users').get('888');
  assert.equal(user.code, '1146');
  assert.equal(user.last_name, 'Toirov');
  assert.equal(user.gender, 'male');
  assert.equal(user.birth_date, '1990-04-25', 'sana ISO ga o\'girilishi kerak');
  assert.equal(user.name, 'Rozi', 'Telegram maydonlari saqlanishi kerak');
});

await test('qayta /start bosilganda kontakt so\'ralmaydi — kod darhol keladi', async () => {
  telegramCalls.length = 0;
  const res = await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({ message: { chat: { id: 777 }, text: '/start' } }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });
  assert.equal(res.status, 200);

  const sent = telegramCalls.find((c) => c.body.text?.includes('kirish kodingiz'));
  assert.ok(sent, 'kod yuborilishi kerak');
  assert.ok(sent.body.text.includes('<code>'), 'kod bosib nusxalanadigan bo\'lishi kerak');
  assert.ok(!sent.body.reply_markup?.keyboard, 'kontakt tugmasi chiqmasligi kerak');
});

await test('birinchi /start da kontakt so\'raladi', async () => {
  telegramCalls.length = 0;
  await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({ message: { chat: { id: 7007 }, text: '/start' } }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });
  const greeting = telegramCalls[0];
  assert.ok(greeting?.body.reply_markup?.keyboard, 'kontakt ulashish tugmasi bo\'lishi kerak');
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

await test('kirishda 1C profili yangilanadi', async () => {
  seed('test_individuals', '+998901234567|555A', {
    phone: '+998901234567', sort_key: '555A', Surname: 'Azizova', Birthday: '25.04.1990',
  });
  await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({ message: { chat: { id: 777 }, text: '/start' } }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });
  const code = tableOf('test_otp_codes').get('+998901234567').code;
  const res = await call(
    authVerify,
    'https://dimed.uz/api/auth-verify',
    jsonBody({ phone: '+998901234567', code }),
  );
  assert.equal(res.status, 200);
  assert.equal(tableOf('test_users').get('777').code, '555A');
  assert.equal(tableOf('test_users').get('777').last_name, 'Azizova');
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

/*
  Bron uchun bemor (tug'ilgan sanasi bilan) majburiy (B1). Azizova
  (555A) 1C dan Birthday bilan kelgan — bron shu bemor nomiga olinadi.
*/
const bookAs = (obj) => authed({ patientId: '555A', ...obj });

await test('bemorsiz yoki tug\'ilgan sanasiz bron qilinmaydi', async () => {
  const noPatient = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00',
  }));
  assert.equal(noPatient.status, 400, 'hali hech kim tanlanmagan — bemor so\'raladi');
  assert.match((await noPatient.json()).error, /kim uchun/);

  seed('test_individuals', '+998901234567|556B', {
    phone: '+998901234567', sort_key: '556B', Surname: 'Sanasiz', Name: 'Bemor',
  });
  const noBirth = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00', patientId: '556B',
  }));
  assert.equal(noBirth.status, 400);
  assert.match((await noBirth.json()).error, /tug‘ilgan sana/);
  assert.equal(tableOf('test_appointments').has(`ashurov#${BOOK_DATE}|09:00`), false);
});

await test('bron qilinadi va botga tasdiq ketadi', async () => {
  telegramCalls.length = 0;
  const res = await call(book, 'https://dimed.uz/api/book', bookAs({
    doctor: 'ashurov', date: BOOK_DATE, time: '09:00',
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.mode, 'at_clinic');
  assert.equal(data.appointment.patientName, 'Azizova');
  assert.equal(data.appointment.patientBirthDate, '1990-04-25');
  const appt = tableOf('test_appointments').get(`ashurov#${BOOK_DATE}|09:00`);
  assert.equal(appt.status, 'booked', 'klinikada to\'lash — darhol band');
  assert.equal(appt.hold_until, undefined, 'bunda hold muddati bo\'lmasligi kerak');
  assert.equal(appt.patient_birth_date, '1990-04-25', 'tug\'ilgan sana navbat yozuviga tushadi');
  assert.ok(telegramCalls.some((c) => c.body.text.includes('band qilindi')));
});

await test('band slot ikkinchi marta olinmaydi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', bookAs({
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
  const res = await call(book, 'https://dimed.uz/api/book', bookAs({
    doctor: 'ashurov', date: BOOK_DATE, time: '12:30',
  }));
  assert.equal(res.status, 400);
});

await test('o\'tgan kunga bron qilib bo\'lmaydi', async () => {
  const res = await call(book, 'https://dimed.uz/api/book', bookAs({
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
  assert.equal(cabinet.results.length, 1, 'bir sanadagi natijalar bitta buyurtma');
  assert.equal(cabinet.results[0].items.length, 1);
  assert.equal(cabinet.results[0].items[0].title, 'Gemoglobin');
  assert.equal(cabinet.results[0].items[0].reference, '120 – 160');
});

await test('1C to\'g\'ridan-to\'g\'ri yozgan hujjat analitlarga yoyiladi', async () => {
  seed('test_analysis_results', '+998901234567|doc-uuid-1', {
    phone: '+998901234567',
    sort_key: 'doc-uuid-1',
    Date: '21.08.2026 14:30:00',
    SampleID: '4127',
    Biomaterial: 'Qon',
    AnalysisResults: [
      { Analyte: 'Gemoglobin', Result: '132', AnalyteUnit: 'g/L', AnalyteInternationalCode: 'HGB' },
      { Analyte: 'Leykotsitlar', Result: '6.2', AnalyteUnit: '10^9/L' },
    ],
  });

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();

  const doc = cabinet.results.find((r) => r.id === 'doc-uuid-1');
  assert.ok(doc, 'hujjat bitta yozuv bo\'lishi kerak');
  assert.equal(doc.items.length, 2, 'ikkala analit ham bir buyurtmada');
  assert.equal(doc.biomaterial, 'Qon');
  assert.equal(doc.date, '2026-08-21T14:30:00', '1C sanasi ISO ga o\'girilishi kerak');
  const hgb = doc.items.find((i) => i.title === 'Gemoglobin');
  assert.equal(hgb.value, '132 g/L');
  assert.equal(hgb.code, 'HGB');
  assert.ok(doc.items.some((i) => i.title === 'Leykotsitlar'), 'ikkinchi analit ham chiqishi kerak');

  // 1C soatni bir xonali yuborishi mumkin: "9:05:00"
  seed('test_analysis_results', '+998901234567|doc-uuid-2', {
    phone: '+998901234567',
    sort_key: 'doc-uuid-2',
    Date: '05.01.2026 9:05:00',
    AnalysisResults: [{ Analyte: 'Kreatinin', Result: '80', AnalyteUnit: 'mkmol/l' }],
  });
  const again = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();
  const kre = again.results.find((r) => r.id === 'doc-uuid-2');
  assert.equal(kre.items[0].title, 'Kreatinin');
  assert.equal(kre.date, '2026-01-05T09:05:00', 'bir xonali soat ham ISO bo\'lishi kerak');

  // 1C adashib lab_results ga yozgan hujjat: kabinet yiqilmasin,
  // analitlari esa ko'rinsin (1420 ta shunday yozuv bor edi).
  seed('test_lab_results', '+998901234567|doc-stray-1', {
    phone: '+998901234567',
    sort_key: 'doc-stray-1',
    Date: '10.02.2026 11:00:00',
    AnalysisResults: [{ Analyte: 'Bilirubin', Result: '12', AnalyteUnit: 'mkmol/l' }],
  });
  // Xuddi shu hujjat to'g'ri jadvalda ham bo'lsa — bir marta chiqadi.
  seed('test_analysis_results', '+998901234567|doc-stray-1', {
    phone: '+998901234567',
    sort_key: 'doc-stray-1',
    Date: '10.02.2026 11:00:00',
    AnalysisResults: [{ Analyte: 'Bilirubin', Result: '12', AnalyteUnit: 'mkmol/l' }],
  });
  const uchinchi = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();
  const bil = uchinchi.results.filter((r) => r.id === 'doc-stray-1');
  assert.equal(bil.length, 1, 'takror hujjat bir marta ko\'rinishi kerak');
  assert.equal(bil[0].items[0].value, '12 mkmol/l');
});

await test('natijalar bir sahifaga sig\'masa ham hammasi ko\'rinadi', async () => {
  // 1C butun tarixni to'kib yuborishi mumkin. Hujjat sort kaliti — UUID,
  // ya'ni tartibi sanaga bog'liq emas: bitta sahifa bilan cheklansak,
  // bemor tasodifiy yozuvlarni ko'rardi.
  for (let i = 0; i < 60; i++) {
    const key = `ko\u2018p-${String(i).padStart(3, '0')}`;
    seed('test_analysis_results', `+998901234567|${key}`, {
      phone: '+998901234567',
      sort_key: key,
      Date: '01.03.2026 10:00:00',
      AnalysisResults: [{ Analyte: `Ko\u2018rsatkich ${i}`, Result: String(i) }],
    });
  }

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();

  const yuklangan = cabinet.results.filter((r) => r.id.startsWith('ko\u2018p-'));
  assert.equal(yuklangan.length, 60, 'barcha sahifalar o\'qilishi kerak');
  assert.equal(yuklangan[0].items.length, 1);
});

await test('bekor qilingan va o\'chirilgan natija kabinetda ko\'rinmaydi', async () => {
  seed('test_analysis_results', '+998901234567|doc-bekor', {
    phone: '+998901234567', sort_key: 'doc-bekor', Date: '02.03.2026 10:00:00',
    Posted: false,
    AnalysisResults: [{ Analyte: 'Bekor qilingan tahlil', Result: '1' }],
  });
  seed('test_analysis_results', '+998901234567|doc-ochirilgan', {
    phone: '+998901234567', sort_key: 'doc-ochirilgan', Date: '02.03.2026 11:00:00',
    DeletionMark: true,
    AnalysisResults: [{ Analyte: 'O\u2018chirilgan tahlil', Result: '2' }],
  });
  seed('test_analysis_results', '+998901234567|doc-kuchda', {
    phone: '+998901234567', sort_key: 'doc-kuchda', Date: '02.03.2026 12:00:00',
    Posted: true, DeletionMark: false,
    AnalysisResults: [{ Analyte: 'Kuchdagi tahlil', Result: '3' }],
  });

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();
  const nomlar = cabinet.results.flatMap((r) => r.items.map((i) => i.title));

  assert.ok(!nomlar.includes('Bekor qilingan tahlil'), 'Posted=false ko\'rinmasligi kerak');
  assert.ok(!nomlar.includes('O\u2018chirilgan tahlil'), 'DeletionMark ko\'rinmasligi kerak');
  assert.ok(nomlar.includes('Kuchdagi tahlil'), 'kuchdagi natija ko\'rinishi kerak');
});

await test('analit nomi bo\'sh bo\'lsa qator yo\'qolmaydi', async () => {
  seed('test_analysis_results', '+998901234567|doc-nomsiz', {
    phone: '+998901234567', sort_key: 'doc-nomsiz', Date: '03.03.2026 10:00:00',
    AnalysisResults: [
      { Analyte: '', Result: '5.4', AnalyteUnit: 'mmol/L', AnalyteInternationalCode: '2345-7' },
      { Analyte: '   ', Result: '', AnalyteUnit: '' },
    ],
  });

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();

  const nomsiz = cabinet.results.find((r) => r.id === 'doc-nomsiz');
  assert.equal(nomsiz.items.length, 1, 'nomi ham qiymati ham yo\'q qator tashlab yuboriladi');
  assert.equal(nomsiz.items[0].title, '2345-7', 'nomsiz analit xalqaro kod bilan chiqadi');
  assert.equal(nomsiz.items[0].value, '5.4 mmol/L');
});

await test('natijada bemor ismi bo\'ladi (bir telefon — oila)', async () => {
  seed('test_analysis_results', '+998901234567|doc-oila', {
    phone: '+998901234567', sort_key: 'doc-oila', Date: '04.03.2026 10:00:00',
    PatientName: 'Yo\u2018ldosheva Nilufar Anvarovna',
    AnalysisResults: [{ Analyte: 'Ferritin', Result: '45', AnalyteUnit: 'ng/mL' }],
  });

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();
  const ferritin = cabinet.results.find((r) => r.id === 'doc-oila');
  assert.equal(ferritin.items[0].title, 'Ferritin');
  assert.equal(ferritin.patientName, 'Yo\u2018ldosheva Nilufar Anvarovna');
});

await test('bir telefondagi oiladan Telegram egasi tanlanadi', async () => {
  seed('test_individuals', '+998909999999|10482', {
    phone: '+998909999999', sort_key: '10482',
    Surname: 'Yo\u2018ldoshev', Name: 'Anvar', Patronymic: 'Baxtiyorovich', IsMale: true,
  });
  seed('test_individuals', '+998909999999|10483', {
    phone: '+998909999999', sort_key: '10483',
    Surname: 'Yo\u2018ldosheva', Name: 'Nilufar', Patronymic: 'Anvarovna', IsMale: false,
  });

  const res = await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({
      message: {
        chat: { id: 555 },
        contact: { phone_number: '998909999999', first_name: 'Nilufar', last_name: 'Yoldosheva' },
      },
    }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });
  assert.equal(res.status, 200);

  const user = tableOf('test_users').get('555');
  assert.equal(user.code, '10483', 'birinchisi emas, ism mos kelgani tanlanishi kerak');
  assert.equal(user.gender, 'female');
  assert.equal(user.telegram_name, 'Yoldosheva Nilufar', 'Telegram ismi 1C dan keyin ham qolishi kerak');
});

await test('o\'chirishga belgilangan bemor profil sifatida olinmaydi', async () => {
  seed('test_individuals', '+998907777770|20001', {
    phone: '+998907777770', sort_key: '20001', Surname: 'Eski', Name: 'Yozuv',
    DeletionMark: true,
  });
  seed('test_individuals', '+998907777770|20002', {
    phone: '+998907777770', sort_key: '20002', Surname: 'Yangi', Name: 'Yozuv',
  });

  await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({
      message: { chat: { id: 557 }, contact: { phone_number: '998907777770', first_name: 'Yozuv' } },
    }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });

  const user = tableOf('test_users').get('557');
  assert.equal(user.code, '20002');
  assert.equal(user.last_name, 'Yangi', 'o\'chirilgan yozuv o\'tkazib yuborilishi kerak');
});

await test('1C kodidagi guruh ajratkichi tozalanadi', async () => {
  // 1C kodni son sifatida saqlaydi: String(10482) → "10 482".
  seed('test_individuals', '+998908888888|10 482', {
    phone: '+998908888888', sort_key: '10 482', Surname: 'Karimov', Name: 'Sardor',
  });

  await call(telegramWebhook, 'https://dimed.uz/api/telegram-webhook', {
    ...jsonBody({
      message: { chat: { id: 556 }, contact: { phone_number: '998908888888', first_name: 'Sardor' } },
    }),
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'webhook-secret' },
  });

  assert.equal(tableOf('test_users').get('556').code, '10482', 'kod bo\'shliqsiz saqlanishi kerak');
});

await test('noto\'g\'ri API kalit bilan 1C rad etiladi', async () => {
  const res = await call(lcResults, 'https://dimed.uz/api/lc-results', {
    ...jsonBody({ phone: '+998901234567', results: [{ code: '1', title: 'X' }] }),
    headers: { 'content-type': 'application/json', 'x-api-key': 'yolgon' },
  });
  assert.equal(res.status, 401);
});

console.log('\nBemorni tanlash (bir telefon — bir oila):');

await test('sessiyasiz /api/patients 401 qaytaradi', async () => {
  const res = await call(patientsApi, 'https://dimed.uz/api/patients');
  assert.equal(res.status, 401);
});

await test('1C dagi oila a\'zolari variant sifatida chiqadi', async () => {
  seed('test_individuals', '+998901234567|30001', {
    phone: '+998901234567', sort_key: '30001',
    Surname: 'Toirov', Name: 'Rozimuhammad', Patronymic: 'Alisherovich',
  });
  seed('test_individuals', '+998901234567|30002', {
    phone: '+998901234567', sort_key: '30002',
    FullName: 'Toirova Malika Rozimuhammadovna', Birthday: '2015-06-01',
  });
  seed('test_individuals', '+998901234567|30003', {
    phone: '+998901234567', sort_key: '30003',
    Surname: 'Eski', Name: 'Yozuv', DeletionMark: true,
  });

  const data = await (await call(patientsApi, 'https://dimed.uz/api/patients', {
    headers: { cookie: sessionCookie },
  })).json();

  const nomlar = data.patients.map((p) => p.name);
  assert.ok(nomlar.includes('Toirov Rozimuhammad Alisherovich'));
  assert.ok(nomlar.includes('Toirova Malika Rozimuhammadovna'));
  assert.ok(!nomlar.some((n) => n.includes('Eski')), 'o\'chirilgani chiqmasligi kerak');
  assert.equal(data.activeId, null, 'hali hech kim tanlanmagan');

  const azizova = data.patients.find((p) => p.id === '555A');
  assert.equal(azizova.birthDate, '1990-04-25', '1C Birthday ISO ko\'rinishida qaytadi');
  const toirov = data.patients.find((p) => p.id === '30001');
  assert.equal(toirov.birthDate, null, 'Birthday bo\'lmasa null');
});

await test('mavjud bemorga tug\'ilgan sana kiritiladi (1C va saytniki)', async () => {
  const bad = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'birthDate', id: '30001', birthDate: '2030-02-30' }),
  });
  assert.equal(bad.status, 400, 'haqiqiy bo\'lmagan sana rad etiladi');

  const res = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'birthDate', id: '30001', birthDate: '1988-12-01' }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).patient.birthDate, '1988-12-01');
  assert.equal(tableOf('test_users').get('777').birth_dates['30001'], '1988-12-01',
    '1C bemorining sanasi users.birth_dates da turadi');

  const data = await (await call(patientsApi, 'https://dimed.uz/api/patients', {
    headers: { cookie: sessionCookie },
  })).json();
  assert.equal(data.patients.find((p) => p.id === '30001').birthDate, '1988-12-01');

  const yoq = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'birthDate', id: 'yoq-bunday', birthDate: '1988-12-01' }),
  });
  assert.equal(yoq.status, 404);
});

await test('yangi oila a\'zosi qo\'shiladi va tanlanadi', async () => {
  const bad = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'add', firstName: 'Sardor' }),
  });
  assert.equal(bad.status, 400, 'familiyasiz qabul qilinmaydi');

  const noBirth = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'add', firstName: 'Sardor', lastName: 'Karimov' }),
  });
  assert.equal(noBirth.status, 400, 'tug\'ilgan sanasiz qabul qilinmaydi');
  assert.match((await noBirth.json()).error, /Tug‘ilgan sana/);

  const res = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({
      action: 'add', firstName: 'Sardor', lastName: 'Karimov', birthDate: '2019-03-08',
    }),
  });
  assert.equal(res.status, 200);
  const { patient, activeId } = await res.json();
  assert.equal(patient.name, 'Karimov Sardor');
  assert.equal(patient.source, 'local');
  assert.equal(patient.birthDate, '2019-03-08');
  assert.equal(activeId, patient.id, 'yangi qo\'shilgani darhol tanlanadi');
  const saved = tableOf('test_users').get('777').patients.find((p) => p.id === patient.id);
  assert.equal(saved.birth_date, '2019-03-08', 'bemor yozuviga saqlanadi');

  const data = await (await call(patientsApi, 'https://dimed.uz/api/patients', {
    headers: { cookie: sessionCookie },
  })).json();
  assert.ok(data.patients.some((p) => p.id === patient.id));
});

await test('boshqa bemorni tanlash saqlanadi', async () => {
  const res = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'select', id: '30001' }),
  });
  assert.equal(res.status, 200);

  const data = await (await call(patientsApi, 'https://dimed.uz/api/patients', {
    headers: { cookie: sessionCookie },
  })).json();
  assert.equal(data.activeId, '30001');

  const yolgon = await call(patientsApi, 'https://dimed.uz/api/patients', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessionCookie },
    body: JSON.stringify({ action: 'select', id: 'yoq-bunday' }),
  });
  assert.equal(yolgon.status, 404);
});

await test('navbat tanlangan bemor nomiga olinadi', async () => {
  const yolgon = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: BOOK_DATE, time: '11:00', patientId: 'yoq-bunday',
  }));
  assert.equal(yolgon.status, 404, 'noma\'lum bemor bilan bron qilinmaydi');

  const res = await call(book, 'https://dimed.uz/api/book', authed({
    doctor: 'ashurov', date: BOOK_DATE, time: '11:00', patientId: '30002',
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.appointment.patientName, 'Toirova Malika Rozimuhammadovna');

  const appt = tableOf('test_appointments').get(`ashurov#${BOOK_DATE}|11:00`);
  assert.equal(appt.patient_id, '30002');
  assert.equal(appt.patient_name, 'Toirova Malika Rozimuhammadovna');

  // Kabinetda ham kimniki ekani ko'rinadi.
  const cabinet = await (await call(me, 'https://dimed.uz/api/me', {
    headers: { cookie: sessionCookie },
  })).json();
  const olingan = cabinet.appointments.find((a) => a.time === '11:00' && a.date === BOOK_DATE);
  assert.equal(olingan.patientName, 'Toirova Malika Rozimuhammadovna');

  // Keyingi testlar bemorda bitta qabul bo'lishiga tayanadi.
  tableOf('test_appointments').delete(`ashurov#${BOOK_DATE}|11:00`);
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

await test('shifokor kelgusi kun navbatini ?date bilan ko\'radi', async () => {
  // BOOK_DATE ga bemor navbati bor (yuqoridagi bron testidan).
  const res = await call(doctorSchedule, `https://dimed.uz/api/doctor-schedule?date=${BOOK_DATE}`, {
    headers: { cookie: doctorCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.date, BOOK_DATE);
  assert.ok(data.appointments.length >= 1, 'kelgusi kunning navbati ko\'rinishi kerak');
  assert.ok(data.appointments[0].phone.includes('•'), 'telefon niqoblangan bo\'lishi kerak');

  const bad = await call(doctorSchedule, 'https://dimed.uz/api/doctor-schedule?date=21-08-2026', {
    headers: { cookie: doctorCookie },
  });
  assert.equal(bad.status, 400, 'noto\'g\'ri sana rad etilishi kerak');
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
  assert.equal(moved.patient_name, 'Azizova', 'bemor kimligi yangi yozuvga ko\'chishi kerak');
  assert.equal(moved.patient_birth_date, '1990-04-25');
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

console.log('\nPayme to\'lovi:');

const PAY_DATE = addDays(toTashkent(new Date()).dateKey, 4);
const rpc = (method, params, auth = 'Paycom:payme-secret') =>
  call(paymentWebhook, 'https://dimed.uz/api/payment-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Basic ${Buffer.from(auth).toString('base64')}` } : {}),
    },
    body: JSON.stringify({ id: 1, method, params }),
  }).then((r) => r.json());

let payOrder; // { paymentId, amountTiyin, time }

await test('kalitsiz so\'rov rad etiladi (-32504)', async () => {
  const res = await rpc('CheckPerformTransaction', { amount: 100, account: { order_id: 'x' } }, null);
  assert.equal(res.error.code, -32504);
});

await test('onlayn bron Payme havolasini qaytaradi', async () => {
  process.env.PAYME_ENABLED = '1';

  const free = await (await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${PAY_DATE}`)).json();
  const time = free.slots.find((s) => s.free).time;

  const res = await call(book, 'https://dimed.uz/api/book', bookAs({
    doctor: 'ashurov', date: PAY_DATE, time,
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.mode, 'online');
  assert.ok(data.redirectUrl.startsWith('https://checkout.paycom.uz/'));

  const decoded = Buffer.from(data.redirectUrl.split('/').pop(), 'base64').toString();
  assert.ok(decoded.includes(`ac.order_id=${data.paymentId}`));
  assert.ok(decoded.includes('a=7000000'), '70 000 so\'m = 7 000 000 tiyin');

  payOrder = { paymentId: data.paymentId, amountTiyin: 7000000, time };
});

await test('CheckPerformTransaction: yo\'q buyurtma -31050, noto\'g\'ri summa -31001', async () => {
  const missing = await rpc('CheckPerformTransaction', { amount: 1, account: { order_id: 'yoq' } });
  assert.equal(missing.error.code, -31050);

  const wrong = await rpc('CheckPerformTransaction', {
    amount: 5, account: { order_id: payOrder.paymentId },
  });
  assert.equal(wrong.error.code, -31001);

  const ok = await rpc('CheckPerformTransaction', {
    amount: payOrder.amountTiyin, account: { order_id: payOrder.paymentId },
  });
  assert.equal(ok.result.allow, true);
});

await test('CreateTransaction yaratadi, takrori bir xil javob beradi', async () => {
  const params = {
    id: 'payme-tx-1', time: Date.now(), amount: payOrder.amountTiyin,
    account: { order_id: payOrder.paymentId },
  };
  const first = await rpc('CreateTransaction', params);
  assert.equal(first.result.state, 1);
  assert.equal(first.result.transaction, payOrder.paymentId);

  const second = await rpc('CreateTransaction', params);
  assert.equal(second.result.state, 1);
  assert.equal(second.result.create_time, first.result.create_time);

  const other = await rpc('CreateTransaction', { ...params, id: 'payme-tx-boshqa' });
  assert.equal(other.error.code, -31099, 'bitta buyurtmaga bitta tranzaksiya');
});

await test('PerformTransaction slotni paid qiladi va bemorga xabar boradi', async () => {
  telegramCalls.length = 0;
  const res = await rpc('PerformTransaction', { id: 'payme-tx-1' });
  assert.equal(res.result.state, 2);

  const cabinet = await (await call(me, 'https://dimed.uz/api/me', { headers: { cookie: sessionCookie } })).json();
  const appt = cabinet.appointments.find((a) => a.date === PAY_DATE && a.time === payOrder.time);
  assert.equal(appt.status, 'paid');
  assert.ok(telegramCalls.some((c) => c.body.text?.includes('tasdiqlandi')), 'tasdiq xabari ketishi kerak');

  const again = await rpc('PerformTransaction', { id: 'payme-tx-1' });
  assert.equal(again.result.state, 2, 'takror chaqiruv ham 2 qaytaradi');
  assert.equal(again.result.perform_time, res.result.perform_time);
});

await test('CheckTransaction holatni to\'g\'ri ko\'rsatadi', async () => {
  const res = await rpc('CheckTransaction', { id: 'payme-tx-1' });
  assert.equal(res.result.state, 2);
  assert.ok(res.result.perform_time > 0);
  assert.equal(res.result.transaction, payOrder.paymentId);

  const missing = await rpc('CheckTransaction', { id: 'yoq-tx' });
  assert.equal(missing.error.code, -31003);
});

await test('CancelTransaction to\'lovni qaytaradi va slotni bo\'shatadi', async () => {
  const res = await rpc('CancelTransaction', { id: 'payme-tx-1', reason: 5 });
  assert.equal(res.result.state, -2, 'to\'langanidan keyin bekor -2');

  const free = await (await call(slots, `https://dimed.uz/api/slots?doctor=ashurov&date=${PAY_DATE}`)).json();
  const slot = free.slots.find((s) => s.time === payOrder.time);
  assert.equal(slot.free, true, 'slot yana bo\'sh bo\'lishi kerak');

  delete process.env.PAYME_ENABLED;
});

stopFakeDynamo();
console.log(`\n${passed} ta API tekshiruvi o'tdi.`);
