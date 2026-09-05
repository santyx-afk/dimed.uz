/**
 * Shifokorlarning qabul davomiyligini bazada bir xil qiymatga o'tkazadi.
 *
 * Sabab: standart qabul davomiyligi 60 daqiqa bo'ldi (B3). Yangi
 * shifokorlar shu qiymat bilan yaratiladi, mavjudlarida esa bazada
 * eski 15/20/30 turibdi — ularni shu skript yangilaydi. Slotlar har
 * safar jadvaldan qayta hisoblanadi, shuning uchun band qilingan
 * navbatlar tegilmaydi.
 *
 * Ishlatish:
 *   node scripts/migrate-slot-minutes.mjs --dry            # faqat ko'rish
 *   node scripts/migrate-slot-minutes.mjs                  # hammasini 60 ga
 *   node scripts/migrate-slot-minutes.mjs --minutes 30     # boshqa qiymat
 *   node scripts/migrate-slot-minutes.mjs --only ashurov,rahimov
 *
 * Qayta ishga tushirish xavfsiz: allaqachon mos kelganlar o'tkazib
 * yuboriladi, telegram_id va boshqa maydonlarga tegilmaydi.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { clientConfig, explainMissingTable, printTarget, PREFIX as prefix } from './aws-env.mjs';

/** netlify/functions/lib/schedule.ts dagi ro'yxat bilan bir xil bo'lishi kerak. */
const ALLOWED = [10, 15, 20, 30, 60];
const DEFAULT_MINUTES = 60;

const table = `${prefix}_doctors`;
const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig()));

const die = (message) => {
  console.error(`Xato: ${message}`);
  process.exit(1);
};

// --- argumentlar ---
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const flagValue = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const minutes = Number(flagValue('--minutes') ?? DEFAULT_MINUTES);
if (!ALLOWED.includes(minutes)) {
  die(`--minutes ${ALLOWED.join(', ')} dan biri bo'lishi kerak (berildi: ${flagValue('--minutes')})`);
}

const only = (flagValue('--only') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

printTarget();
if (dry) console.log('Sinov rejimi (--dry): bazaga hech narsa yozilmaydi.\n');

// --- shifokorlar ---
const { Items = [] } = await db
  .send(new ScanCommand({ TableName: table }))
  .catch(explainMissingTable(table));

if (Items.length === 0) {
  console.log(`${table} bo'sh — avval "npm run seed-doctors" ni ishga tushiring.`);
  process.exit(0);
}

const picked = only.length ? Items.filter((d) => only.includes(d.doctor_id)) : Items;
for (const id of only) {
  if (!Items.some((d) => d.doctor_id === id)) die(`"${id}" ${table} jadvalida yo'q`);
}

let changed = 0;
let skipped = 0;
const now = new Date().toISOString();

for (const d of picked.sort((a, b) => a.doctor_id.localeCompare(b.doctor_id))) {
  const current = d.slot_minutes;
  const label = `${d.doctor_id.padEnd(14)} ${String(d.name ?? '').padEnd(26)}`;

  if (current === minutes) {
    console.log(`  =  ${label} ${current} daq — o'zgarishsiz`);
    skipped++;
    continue;
  }

  if (!dry) {
    await db.send(
      new UpdateCommand({
        TableName: table,
        Key: { doctor_id: d.doctor_id },
        UpdateExpression: 'SET slot_minutes = :m, updated_at = :u',
        ExpressionAttributeValues: { ':m': minutes, ':u': now },
      }),
    );
  }
  console.log(`  ${dry ? '~' : '+'}  ${label} ${current ?? '—'} → ${minutes} daq`);
  changed++;
}

console.log(
  `\n${picked.length} ta shifokor: ${changed} ta ${dry ? "o'zgaradi" : "o'zgardi"}, ` +
    `${skipped} tasi allaqachon ${minutes} daq.`,
);
if (dry && changed) console.log('Yozish uchun --dry siz qayta ishga tushiring.');
