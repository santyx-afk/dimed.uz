/**
 * src/data/analyses.json dagi tahlil narxlarini DynamoDB `prices`
 * jadvaliga yozadi (F2). Sayt narxlarni shu jadvaldan o'qiydi, admin
 * panel tahrirlaydi.
 *
 * Standart rejim ehtiyotkor: jadvalda allaqachon bor yozuv (admin
 * tahrirlagan bo'lishi mumkin) tegilmaydi, faqat yo'qlari qo'shiladi.
 * Hammasini qayta yozish uchun --force.
 *
 * Ishlatish:
 *   node scripts/seed-prices.mjs            # yo'qlarini qo'shish
 *   node scripts/seed-prices.mjs --dry      # faqat ko'rish
 *   node scripts/seed-prices.mjs --force    # bor yozuvlarni ham yangilash
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import { clientConfig, explainMissingTable, printTarget, PREFIX as prefix } from './aws-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const table = `${prefix}_prices`;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const force = args.includes('--force');

const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig()), {
  marshallOptions: { removeUndefinedValues: true },
});
printTarget();
if (dry) console.log('Sinov rejimi (--dry): bazaga hech narsa yozilmaydi.\n');

/** "65 000" → 65000 */
export const parsePrice = (raw) => Number(String(raw ?? '').replace(/[^\d]/g, '')) || 0;

const analyses = JSON.parse(readFileSync(join(root, 'src', 'data', 'analyses.json'), 'utf8'));
const now = new Date().toISOString();

let added = 0;
let skipped = 0;
let updated = 0;

for (const a of analyses) {
  const item = {
    item_id: `analysis#${a.code}`,
    kind: 'analysis',
    code: a.code,
    title: a.title,
    group: a.group,
    duration: a.duration,
    price: parsePrice(a.price),
    active: true,
    updated_at: now,
  };

  if (dry) {
    console.log(`  ~  ${item.item_id.padEnd(16)} ${a.title} — ${item.price} so'm`);
    added++;
    continue;
  }

  try {
    await db.send(
      new PutCommand({
        TableName: table,
        Item: item,
        // Admin tahrirlagan narx seed'da o'chib ketmasin.
        ...(force ? {} : { ConditionExpression: 'attribute_not_exists(item_id)' }),
      }),
    );
    if (force) updated++;
    else added++;
    console.log(`  +  ${item.item_id.padEnd(16)} ${a.title} — ${item.price} so'm`);
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') {
      skipped++;
      continue;
    }
    explainMissingTable(table)(err);
  }
}

console.log(
  `\n${analyses.length} ta tahlil: ` +
    (dry
      ? `${added} tasi yoziladi`
      : force
        ? `${updated} tasi yangilandi`
        : `${added} tasi qo'shildi, ${skipped} tasi allaqachon bor edi (tegilmadi)`) +
    '.',
);
