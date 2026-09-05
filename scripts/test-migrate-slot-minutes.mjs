/**
 * migrate-slot-minutes.mjs ni soxta DynamoDB bilan sinaydi.
 *
 * Skript alohida jarayonda ishga tushiriladi — haqiqiy ishlatishda
 * qanday chaqirilsa, shundayligicha.
 *
 * Ishlatish: node scripts/test-migrate-slot-minutes.mjs
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { startFakeDynamo, stopFakeDynamo, seed, tableOf } from './fake-dynamo.mjs';

const run = promisify(execFile);
const script = join(dirname(fileURLToPath(import.meta.url)), 'migrate-slot-minutes.mjs');
const endpoint = await startFakeDynamo();

const env = {
  ...process.env,
  DIMED_DYNAMO_ENDPOINT: endpoint,
  DIMED_TABLE_PREFIX: 'test',
  DIMED_AWS_REGION: 'eu-central-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
};

const migrate = async (...args) => {
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

const minutesOf = (id) => tableOf('test_doctors').get(id).slot_minutes;

seed('test_doctors', 'ashurov', {
  doctor_id: 'ashurov', name: 'Ashurov Tursunali', slot_minutes: 15, telegram_id: '555',
});
seed('test_doctors', 'rahimov', { doctor_id: 'rahimov', name: 'Rahimov Umidjon', slot_minutes: 20 });
seed('test_doctors', 'abdullayev', { doctor_id: 'abdullayev', name: 'Abdullayev Bekmirza', slot_minutes: 60 });

console.log('Qabul davomiyligi migratsiyasi:');

await test('--dry hech narsani o\'zgartirmaydi, lekin rejani ko\'rsatadi', async () => {
  const res = await migrate('--dry');
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /ashurov.*15 → 60/);
  assert.match(res.out, /2 ta o'zgaradi, 1 tasi allaqachon 60/);
  assert.equal(minutesOf('ashurov'), 15);
  assert.equal(minutesOf('rahimov'), 20);
});

await test('noto\'g\'ri --minutes rad etiladi', async () => {
  const res = await migrate('--minutes', '45');
  assert.equal(res.ok, false);
  assert.match(res.out, /10, 15, 20, 30, 60/);
  assert.equal(minutesOf('ashurov'), 15, 'hech narsa yozilmasligi kerak');
});

await test('--only faqat ko\'rsatilgan shifokorga tegadi', async () => {
  const res = await migrate('--only', 'rahimov');
  assert.equal(res.ok, true, res.out);
  assert.equal(minutesOf('rahimov'), 60);
  assert.equal(minutesOf('ashurov'), 15, 'boshqasi o\'zgarmasligi kerak');
});

await test('noma\'lum shifokor --only da xato beradi', async () => {
  const res = await migrate('--only', 'yoq');
  assert.equal(res.ok, false);
  assert.match(res.out, /jadvalida yo'q/);
});

await test('hammasi 60 ga o\'tadi, telegram_id saqlanadi', async () => {
  const res = await migrate();
  assert.equal(res.ok, true, res.out);
  for (const id of ['ashurov', 'rahimov', 'abdullayev']) assert.equal(minutesOf(id), 60);
  assert.equal(tableOf('test_doctors').get('ashurov').telegram_id, '555');
  assert.ok(tableOf('test_doctors').get('ashurov').updated_at, 'updated_at yozilishi kerak');
});

await test('qayta ishga tushirish idempotent', async () => {
  const res = await migrate();
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /0 ta o'zgardi, 3 tasi allaqachon 60/);
});

stopFakeDynamo();
console.log(`\n${passed} ta tekshiruv o'tdi.`);
