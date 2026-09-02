/**
 * import-patients.mjs ni sinaydi: CSV tahlili alohida, to'liq oqim esa
 * soxta DynamoDB bilan, skript alohida jarayonda — haqiqiy ishlatishda
 * qanday chaqirilsa, shundayligicha.
 *
 * Ishlatish: node scripts/test-import-patients.mjs
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { startFakeDynamo, stopFakeDynamo, seed, tableOf } from './fake-dynamo.mjs';
import { parseCsv, mapHeader, profileFrom } from './import-patients.mjs';

const run = promisify(execFile);
const script = join(dirname(fileURLToPath(import.meta.url)), 'import-patients.mjs');
const endpoint = await startFakeDynamo();

const env = {
  ...process.env,
  DIMED_DYNAMO_ENDPOINT: endpoint,
  DIMED_TABLE_PREFIX: 'test',
  DIMED_AWS_REGION: 'eu-central-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
};

const importFile = async (...args) => {
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

console.log('CSV tahlili:');

await test('ajratgich avtomatik topiladi (;, TAB, vergul)', async () => {
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
});

await test('qo\'shtirnoq ichidagi ajratgich buzmaydi', async () => {
  assert.deepEqual(parseCsv('a,b\n"Toirov, R",2'), [['a', 'b'], ['Toirov, R', '2']]);
});

await test('sarlavha: o\'zbekcha 1C ustunlari topiladi', async () => {
  const map = mapHeader([
    'Code', 'Familiyasi', 'Ismi', 'Sharif', "To'liq Ismi", 'Jinsi',
    "Tug'ilgan kuni", "Tug'ilgan Joyi", 'Telefon', 'Email',
  ]);
  assert.equal(map.code, 0);
  assert.equal(map.last_name, 1);
  assert.equal(map.first_name, 2);
  assert.equal(map.patronymic, 3);
  assert.equal(map.full_name, 4);
  assert.equal(map.gender, 5);
  assert.equal(map.birth_date, 6); // "Tug'ilgan Joyi" emas
  assert.equal(map.phone, 8);
  assert.equal(map.email, 9);
});

await test('qator profilga aylanadi: telefon, jins, sana normallashadi', async () => {
  const map = mapHeader(['Kod', 'Familiyasi', 'Ismi', 'Jinsi', "Tug'ilgan kuni", 'Telefon']);
  const { phone, profile } = profileFrom(
    ['1146', 'Toirov', 'Rozimuhammad', 'Erkak', '25.04.1990', '88 540-07-25'],
    map,
  );
  assert.equal(phone, '+998885400725');
  assert.equal(profile.code, '1146');
  assert.equal(profile.gender, 'male');
  assert.equal(profile.birth_date, '1990-04-25');
  assert.equal(profile.full_name, 'Toirov Rozimuhammad');
});

console.log('\nTo\'liq oqim (soxta DynamoDB):');

// Bitta bemor botga kirgan, bittasi kirmagan.
seed('test_users', '111', { telegram_id: '111', phone: '+998885400725', name: 'santyx' });

const dir = tmpdir();
const csv = join(dir, 'bemorlar-test.csv');
writeFileSync(
  csv,
  'Code;Familiyasi;Ismi;Jinsi;Tug\'ilgan kuni;Telefon\n' +
    '1146;Toirov;Rozimuhammad;Erkak;25.04.1990;+998885400725\n' +
    '2222;Aslanov;Muhammad;Erkak;01.01.2000;+998901112233\n' +
    '3333;Telefonsiz;Bemor;Ayol;02.02.2002;\n',
);

await test('botga kirgan bemor yangilanadi, qolganlari sanaladi', async () => {
  const res = await importFile(csv);
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /Yangilandi: 1 ta/);
  assert.match(res.out, /Botga hali kirmagan: 1 ta/);
  assert.match(res.out, /Aslanov Muhammad/);
  assert.match(res.out, /Telefonsiz qator: 1 ta/);

  const user = tableOf('test_users').get('111');
  assert.equal(user.code, '1146');
  assert.equal(user.last_name, 'Toirov');
  assert.equal(user.birth_date, '1990-04-25');
  assert.equal(user.name, 'santyx', 'Telegram maydoni o\'zgarmasligi kerak');
});

await test('--dry bazaga yozmaydi', async () => {
  seed('test_users', '111', { telegram_id: '111', phone: '+998885400725', name: 'santyx' });
  const res = await importFile(csv, '--dry');
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /Yozilardi: 1 ta/);
  assert.equal(tableOf('test_users').get('111').code, undefined);
});

await test('takror telefon ikkinchi marta yozilmaydi', async () => {
  const dup = join(dir, 'bemorlar-dup.csv');
  writeFileSync(
    dup,
    'Familiyasi;Ismi;Telefon\nBirinchi;Bemor;+998885400725\nIkkinchi;Bemor;+998885400725\n',
  );
  const res = await importFile(dup);
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /takror/);
  assert.match(res.out, /Yangilandi: 1 ta/);
  assert.equal(tableOf('test_users').get('111').last_name, 'Birinchi');
  rmSync(dup);
});

await test('fayl berilmasa tushunarli xato', async () => {
  const res = await importFile();
  assert.equal(res.ok, false);
  assert.match(res.out, /fayl ko'rsatilmadi/);
});

await test('telefon ustuni bo\'lmasa tushunarli xato', async () => {
  const bad = join(dir, 'bemorlar-bad.csv');
  writeFileSync(bad, 'Familiyasi;Ismi\nToirov;R\n');
  const res = await importFile(bad);
  assert.equal(res.ok, false);
  assert.match(res.out, /telefon ustuni topilmadi/);
  rmSync(bad);
});

rmSync(csv);
stopFakeDynamo();
console.log(`\n${passed} ta tekshiruv o'tdi.`);
