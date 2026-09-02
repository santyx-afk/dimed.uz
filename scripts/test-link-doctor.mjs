/**
 * link-doctor.mjs ni soxta DynamoDB bilan sinaydi.
 *
 * Skript alohida jarayonda ishga tushiriladi — haqiqiy ishlatishda
 * qanday chaqirilsa, shundayligicha.
 *
 * Ishlatish: node scripts/test-link-doctor.mjs
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { startFakeDynamo, stopFakeDynamo, seed, tableOf } from './fake-dynamo.mjs';

const run = promisify(execFile);
const script = join(dirname(fileURLToPath(import.meta.url)), 'link-doctor.mjs');
const endpoint = await startFakeDynamo();

const env = {
  ...process.env,
  DIMED_DYNAMO_ENDPOINT: endpoint,
  DIMED_TABLE_PREFIX: 'test',
  DIMED_AWS_REGION: 'eu-central-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
};

/** Skriptni chaqiradi. Xato bo'lsa ham yiqilmaydi — chiqishni qaytaradi. */
const link = async (...args) => {
  try {
    const { stdout } = await run('node', [script, ...args], { env });
    return { ok: true, out: stdout };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
};

let passed = 0;
const test = async (name, fn) => {
  await fn();
  console.log(`  ok  ${name}`);
  passed++;
};

// --- ma'lumot ---
seed('test_doctors', 'ashurov', { doctor_id: 'ashurov', name: 'Ashurov Tursunali' });
seed('test_doctors', 'rahimov', { doctor_id: 'rahimov', name: 'Rahimov Umidjon' });
seed('test_users', '777', { telegram_id: '777', phone: '+998901234567' });

console.log('Shifokorni Telegram bilan bog\'lash:');

await test('argumentsiz ro\'yxat va bog\'lanmaganlar soni chiqadi', async () => {
  const res = await link();
  assert.equal(res.ok, true);
  assert.match(res.out, /ashurov/);
  assert.match(res.out, /BOG'LANMAGAN/);
  assert.match(res.out, /2 ta shifokor, 2 tasi bog'lanmagan/);
});

await test('noma\'lum shifokor rad etiladi', async () => {
  const res = await link('yoq', '--telegram', '999');
  assert.equal(res.ok, false);
  assert.match(res.out, /jadvalida yo'q/);
});

await test('--phone yoki --telegram ko\'rsatilmasa xato', async () => {
  const res = await link('ashurov');
  assert.equal(res.ok, false);
  assert.match(res.out, /--phone yoki --telegram/);
});

await test('telegram_id bo\'yicha bog\'lanadi', async () => {
  const res = await link('rahimov', '--telegram', '555');
  assert.equal(res.ok, true, res.out);
  assert.equal(tableOf('test_doctors').get('rahimov').telegram_id, '555');
});

await test('telefon bo\'yicha bog\'lanadi — telegram_id users dan topiladi', async () => {
  const res = await link('ashurov', '--phone', '998901234567');
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /telegram_id 777/);
  assert.equal(tableOf('test_doctors').get('ashurov').telegram_id, '777');
});

await test('telefon boshqa formatda yozilsa ham topiladi', async () => {
  const res = await link('ashurov', '--phone', '90 123 45 67');
  assert.equal(res.ok, true, res.out);
  assert.equal(tableOf('test_doctors').get('ashurov').telegram_id, '777');
});

await test('bazada yo\'q telefon rad etiladi', async () => {
  const res = await link('rahimov', '--phone', '+998900000000');
  assert.equal(res.ok, false);
  assert.match(res.out, /topilmadi/);
  assert.match(res.out, /kontaktini ulashishi kerak/);
});

await test('bitta Telegram akkaunt ikkita shifokorga bog\'lanmaydi', async () => {
  const res = await link('rahimov', '--telegram', '777');
  assert.equal(res.ok, false);
  assert.match(res.out, /allaqachon "ashurov" ga bog'langan/);
  assert.equal(tableOf('test_doctors').get('rahimov').telegram_id, '555', 'eski bog\'lanish saqlanishi kerak');
});

await test('o\'sha shifokorni qayta bog\'lash mumkin', async () => {
  const res = await link('ashurov', '--telegram', '777');
  assert.equal(res.ok, true, res.out);
  assert.equal(tableOf('test_doctors').get('ashurov').telegram_id, '777');
});

stopFakeDynamo();
console.log(`\n${passed} ta tekshiruv o'tdi.`);
