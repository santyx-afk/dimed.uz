/**
 * seed-prices.mjs ni soxta DynamoDB bilan sinaydi.
 * Ishlatish: node scripts/test-seed-prices.mjs
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { startFakeDynamo, stopFakeDynamo, seed, tableOf } from './fake-dynamo.mjs';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'seed-prices.mjs');
const analyses = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'analyses.json'), 'utf8'));
const endpoint = await startFakeDynamo();

const env = {
  ...process.env,
  DIMED_DYNAMO_ENDPOINT: endpoint,
  DIMED_TABLE_PREFIX: 'test',
  DIMED_AWS_REGION: 'eu-central-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
};

const seedPrices = async (...args) => {
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

console.log('Narxlarni bazaga yozish:');

await test('--dry hech narsa yozmaydi', async () => {
  const res = await seedPrices('--dry');
  assert.equal(res.ok, true, res.out);
  assert.equal(tableOf('test_prices').size, 0);
});

await test('barcha tahlillar narxi bilan yoziladi', async () => {
  const res = await seedPrices();
  assert.equal(res.ok, true, res.out);
  assert.equal(tableOf('test_prices').size, analyses.length);
  const first = analyses[0];
  const row = tableOf('test_prices').get(`analysis#${first.code}`);
  assert.equal(row.title, first.title);
  assert.equal(row.price, Number(first.price.replace(/\s/g, '')), 'narx son sifatida');
  assert.equal(row.active, true);
});

await test('admin tahrirlagan narx qayta seed\'da tegilmaydi', async () => {
  const id = `analysis#${analyses[0].code}`;
  seed('test_prices', id, { ...tableOf('test_prices').get(id), price: 999999 });
  const res = await seedPrices();
  assert.equal(res.ok, true, res.out);
  assert.match(res.out, /allaqachon bor edi/);
  assert.equal(tableOf('test_prices').get(id).price, 999999);
});

await test('--force bor yozuvlarni ham yangilaydi', async () => {
  const id = `analysis#${analyses[0].code}`;
  const res = await seedPrices('--force');
  assert.equal(res.ok, true, res.out);
  assert.equal(tableOf('test_prices').get(id).price, Number(analyses[0].price.replace(/\s/g, '')));
});

stopFakeDynamo();
console.log(`\n${passed} ta tekshiruv o'tdi.`);
