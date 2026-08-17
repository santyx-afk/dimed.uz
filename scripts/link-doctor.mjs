/**
 * Shifokorni Telegram akkauntiga bog'laydi.
 *
 * Shifokor o'z kabinetiga kirishi uchun `doctors` jadvalidagi
 * `telegram_id` to'ldirilgan bo'lishi shart. `seed-doctors` uni
 * yozmaydi — aks holda har seed'da bog'lanish o'chib ketardi.
 *
 * Ishlatish:
 *   node scripts/link-doctor.mjs                                  # ro'yxat
 *   node scripts/link-doctor.mjs ashurov --phone +998901234567    # telefon bo'yicha
 *   node scripts/link-doctor.mjs ashurov --telegram 123456789     # id bo'yicha
 *
 * Telefon bo'yicha bog'lash uchun shifokor avval botga `/start`
 * yuborib, kontaktini ulashgan bo'lishi kerak — shunda uning
 * telegram_id si `users` jadvalida paydo bo'ladi.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { clientConfig, explainMissingTable, PREFIX as prefix } from './aws-env.mjs';

const doctorsTable = `${prefix}_doctors`;
const usersTable = `${prefix}_users`;

const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig()));

/** http.ts dagi bilan bir xil qoida — bazada telefon shu ko'rinishda. */
const normalizePhone = (raw) => {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('998') ? `+${digits}` : `+998${digits.slice(-9)}`;
};

const die = (message) => {
  console.error(`Xato: ${message}`);
  process.exit(1);
};

const [doctorId, flag, value] = process.argv.slice(2);

// --- Argument yo'q: hozirgi holatni ko'rsatamiz ---
if (!doctorId) {
  const { Items = [] } = await db
    .send(new ScanCommand({ TableName: doctorsTable }))
    .catch(explainMissingTable(doctorsTable));
  if (Items.length === 0) {
    console.log(`${doctorsTable} bo'sh — avval "npm run seed-doctors" ni ishga tushiring.`);
    process.exit(0);
  }

  console.log("Shifokorlar va Telegram bog'lanishi:\n");
  for (const d of Items.sort((a, b) => a.doctor_id.localeCompare(b.doctor_id))) {
    const mark = d.telegram_id ? `bog'langan (${d.telegram_id})` : 'BOG\'LANMAGAN — kabinetiga kira olmaydi';
    console.log(`  ${d.doctor_id.padEnd(14)} ${String(d.name ?? '').padEnd(26)} ${mark}`);
  }

  const missing = Items.filter((d) => !d.telegram_id).length;
  console.log(`\n${Items.length} ta shifokor, ${missing} tasi bog'lanmagan.`);
  process.exit(0);
}

// --- Bog'lash ---
if (flag !== '--phone' && flag !== '--telegram') {
  die('--phone yoki --telegram ko\'rsating.\n' +
      '  node scripts/link-doctor.mjs ashurov --phone +998901234567');
}
if (!value) die(`${flag} uchun qiymat berilmadi`);

const doctor = await db
  .send(new GetCommand({ TableName: doctorsTable, Key: { doctor_id: doctorId } }))
  .catch(explainMissingTable(doctorsTable));
if (!doctor.Item) {
  die(`"${doctorId}" ${doctorsTable} jadvalida yo'q. Ro'yxat uchun: node scripts/link-doctor.mjs`);
}

let telegramId = value;

if (flag === '--phone') {
  const phone = normalizePhone(value);
  const { Items = [] } = await db.send(
    new QueryCommand({
      TableName: usersTable,
      IndexName: 'phone-index',
      KeyConditionExpression: 'phone = :p',
      ExpressionAttributeValues: { ':p': phone },
    }),
  );
  if (Items.length === 0) {
    die(`${phone} raqami ${usersTable} da topilmadi.\n` +
        '  Shifokor avval botga /start yuborib, kontaktini ulashishi kerak.');
  }
  telegramId = String(Items[0].telegram_id);
  console.log(`${phone} → telegram_id ${telegramId}`);
}

// Bitta Telegram akkaunt ikkita shifokorga biriktirilmasin —
// telegram-index bo'yicha qidiruv birinchi topilganini qaytaradi.
const { Items: taken = [] } = await db.send(
  new QueryCommand({
    TableName: doctorsTable,
    IndexName: 'telegram-index',
    KeyConditionExpression: 'telegram_id = :t',
    ExpressionAttributeValues: { ':t': telegramId },
  }),
);
const other = taken.find((d) => d.doctor_id !== doctorId);
if (other) {
  die(`Bu Telegram akkaunt allaqachon "${other.doctor_id}" ga bog'langan.\n` +
      '  Avval o\'shani uzing yoki boshqa akkauntdan foydalaning.');
}

await db.send(
  new UpdateCommand({
    TableName: doctorsTable,
    Key: { doctor_id: doctorId },
    UpdateExpression: 'SET telegram_id = :t, updated_at = :u',
    ExpressionAttributeValues: { ':t': telegramId, ':u': new Date().toISOString() },
  }),
);

console.log(`\nTayyor: ${doctorId} (${doctor.Item.name}) → telegram_id ${telegramId}`);
console.log('Shifokor endi /kabinet/shifokor sahifasiga kira oladi.');
