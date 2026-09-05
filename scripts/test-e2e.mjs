/**
 * Brauzerdagi asosiy oqim — bron vidjeti va yopiq sahifalar.
 *
 * Nima uchun: API va mantiq testlari serverni tekshiradi, lekin
 * klinika uchun eng muhim narsa — bemor navbat ola olishi. U faqat
 * brauzerda ko'rinadi: "bemor tanlanmasdan 5-qadamga o'tib ketardi"
 * kabi xato hamma test yashil turganda ham sodir bo'lgan edi.
 *
 * Ishlatish (avval `npm run build`):
 *   npm run test:e2e
 *
 * Server: `astro preview` shu skriptning o'zi ishga tushiradi.
 * API javoblari soxta — baza ham, tarmoq ham kerak emas.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const PORT = Number(process.env.DIMED_E2E_PORT ?? 4399);
const base = `http://127.0.0.1:${PORT}`;

const p2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// --- soxta API ---
const doctors = [
  {
    id: 'ashurov', name: 'Ashurov Tursunali', job: 'Terapevt', deptId: 'terapiya',
    experience: '20+ yil', photo: '/images/team/ashurov-tursunali.webp', hours: 'Du–Sh · 08:00–17:00',
    shifts: [{ start: '08:00', end: '17:00' }], slotMinutes: 60, workdays: [0, 1, 2, 3, 4, 5, 6],
    price: 70000, ratingAvg: null, ratingCount: 0, ageGroup: 'adult',
  },
];
const patients = {
  patients: [
    { id: 'A1', name: 'Azizova Aziza', source: '1c', birthDate: '1990-04-25' },
    { id: 'A2', name: 'Azizov Sardor', source: '1c', birthDate: '2016-05-10' },
  ],
  activeId: null,
};
const slots = {
  slots: ['09:00', '10:00', '11:00'].map((time) => ({ time, free: true })),
  workdays: [0, 1, 2, 3, 4, 5, 6],
};

let booked = null;

async function mockApi(ctx, { signedIn }) {
  await ctx.route('**/api/**', (route) => {
    const url = route.request().url();
    const send = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/api/doctors')) return send(doctors);
    if (url.includes('/api/slots')) return send(slots);
    if (url.includes('/api/prices')) return send({ analyses: [], doctors: [] });
    if (url.includes('/api/session')) {
      return send(signedIn ? { role: 'patient', name: 'Aziza', phone: '+998 90 123 45 67' } : { role: 'guest' });
    }
    // Kirmagan foydalanuvchida kabinet API'lari 401 beradi — sahifalar
    // shunga qarab kirish panelini ko'rsatadi.
    if (url.includes('/api/patients') || url.includes('/api/me') || url.includes('/api/result')) {
      return signedIn ? send(patients) : send({ error: 'Avval kiring' }, 401);
    }
    if (url.includes('/api/book')) {
      booked = JSON.parse(route.request().postData() ?? '{}');
      return send({ ok: true, mode: 'at_clinic', appointment: { patientName: 'Azizova Aziza' } });
    }
    return send({ ok: true });
  });
}

/** 1-qadamdan 4-qadamgacha yuradi. */
async function walkToPatientStep(page) {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await page.waitForTimeout(400);
  await page.click('.dept-btn[data-id="terapiya"]');
  await page.click('.doc-btn');
  await page.waitForTimeout(300);
  await page.click('.slot-btn:not(.busy)');
  await page.waitForTimeout(400);
}

const activeStep = (page) => page.$eval('#wSteps .step-pill.on .lbl', (e) => e.textContent.trim());

// --- serverni ko'tarish ---
const server = spawn('npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
  stdio: 'ignore',
});
const stop = () => {
  server.kill('SIGTERM');
};
process.on('exit', stop);

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  ready = await fetch(base + '/').then((r) => r.ok).catch(() => false);
  if (!ready) await sleep(500);
}
if (!ready) {
  stop();
  throw new Error(`Preview server ko'tarilmadi (${base}). Avval "npm run build" qiling.`);
}

const browser = await chromium.launch(
  process.env.DIMED_CHROMIUM ? { executablePath: process.env.DIMED_CHROMIUM } : {},
);

let passed = 0;
const errors = [];
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  XATO  ${name}\n        ${err.message.split('\n')[0]}`);
    errors.push(name);
  }
};

console.log('Brauzerda asosiy oqim:');

for (const vp of [
  { name: 'mobil', width: 375, height: 900, isMobile: true },
  { name: 'desktop', width: 1280, height: 900, isMobile: false },
]) {
  const size = { viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile };

  await test(`${vp.name}: kirmagan bemor 4-qadamda qoladi va kirish oynasini ko'radi`, async () => {
    const ctx = await browser.newContext(size);
    await mockApi(ctx, { signedIn: false });
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    await walkToPatientStep(page);

    assert.equal(await activeStep(page), 'Bemor', '5-qadamga o‘tib ketmasligi kerak');
    assert.equal(await page.isVisible('#wLogin'), true, 'kirish oynasi ko‘rinishi kerak');
    assert.deepEqual(jsErrors, [], 'sahifada JS xatosi bo‘lmasin');
    await ctx.close();
  });

  await test(`${vp.name}: mos bemor tanlansa bron oxirigacha boradi`, async () => {
    const ctx = await browser.newContext(size);
    await mockApi(ctx, { signedIn: true });
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    await walkToPatientStep(page);
    assert.equal(await activeStep(page), 'Bemor');

    await page.$eval('#privacyOk', (b) => {
      if (!b.checked) b.click();
    });
    await page.click('[data-pick="A1"]');
    await page.waitForTimeout(400);
    assert.equal(await activeStep(page), 'Tasdiqlash', 'bemor tanlangach 5-qadam ochiladi');

    booked = null;
    await page.click('#wBook');
    await page.waitForTimeout(400);
    assert.ok(booked, 'bron so‘rovi ketishi kerak');
    assert.equal(booked.doctor, 'ashurov');
    assert.equal(booked.patientId, 'A1');
    assert.equal(booked.privacyAccepted, true);
    assert.equal(await page.isVisible('.success'), true, 'muvaffaqiyat oynasi ko‘rinishi kerak');
    assert.deepEqual(jsErrors, []);
    await ctx.close();
  });

  await test(`${vp.name}: yoshi mos kelmagan bemor o'tkazilmaydi`, async () => {
    const ctx = await browser.newContext(size);
    await mockApi(ctx, { signedIn: true });
    const page = await ctx.newPage();
    await walkToPatientStep(page);

    await page.$eval('#privacyOk', (b) => {
      if (!b.checked) b.click();
    });
    booked = null;
    await page.click('[data-pick="A2"]');   // 2016-yilda tug'ilgan, shifokor 16+
    await page.waitForTimeout(300);
    assert.equal(await activeStep(page), 'Bemor', '5-qadamga o‘tmasligi kerak');
    assert.match(await page.$eval('#whoMsg', (e) => e.textContent), /16 yoshdan katta/);
    assert.equal(booked, null, 'bron so‘rovi ketmasligi kerak');
    await ctx.close();
  });

  await test(`${vp.name}: kabinet sahifasi kirmaganga tushuntiradi`, async () => {
    const ctx = await browser.newContext(size);
    await mockApi(ctx, { signedIn: false });
    const page = await ctx.newPage();
    await page.goto(base + '/kabinet/tahlillar/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // `$()` yashirin elementni ham topadi — ko'rinayotganini tekshiramiz.
    assert.equal(await page.isVisible('.signin-card'), true, 'kirish paneli ko‘rinishi kerak');
    assert.equal(await page.isVisible('#loading'), false, 'yuklanmoqda yozuvi qolmasin');
    assert.match(await page.$eval('[data-signin-what]', (e) => e.textContent), /tahlil/i);
    assert.equal(await page.isVisible('[data-cabinet-tabs]'), false, 'tablar yashirilsin');
    await ctx.close();
  });
}

await test('telefon raqami har xil yozilsa ham qabul qilinadi', async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, isMobile: true });
  let sentPhone = null;
  await ctx.route('**/api/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth-verify')) {
      sentPhone = JSON.parse(route.request().postData() ?? '{}').phone;
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Kod notoʻgʻri.' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'guest' }) });
  });
  const page = await ctx.newPage();
  await page.goto(base + '/kirish/', { waitUntil: 'networkidle' });

  for (const raw of ['11 111 11 11', '+998 11 111 1111', '111111111']) {
    await page.fill('#phone', raw);
    const boxes = await page.$$('.otp-row input');
    for (let i = 0; i < 6; i++) await boxes[i].fill('1');
    sentPhone = null;
    await page.click('#submit');
    await page.waitForTimeout(200);
    assert.equal(sentPhone, '+998111111111', `${raw} noto‘g‘ri yuborildi`);
  }

  await page.fill('#phone', '123');
  sentPhone = null;
  await page.click('#submit');
  await page.waitForTimeout(200);
  assert.equal(sentPhone, null, 'noto‘g‘ri raqam serverga ketmasligi kerak');
  await ctx.close();
});

await browser.close();
stop();

if (errors.length) {
  console.error(`\n${errors.length} ta tekshiruv yiqildi: ${errors.join(', ')}`);
  process.exit(1);
}
console.log(`\n${passed} ta brauzer tekshiruvi o'tdi.`);
