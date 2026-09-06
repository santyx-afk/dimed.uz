/**
 * Bitta telefon ostida 1C nima yozganini ko'rsatadi.
 *
 * "Raqamimga ulangan hamma ko'rinmayapti" degan savolga javob shu
 * yerdan chiqadi: sayt `dimed_individuals` jadvalidan telefon bo'yicha
 * o'qiydi, ya'ni bemor ro'yxatida faqat shu yozuvlar ko'rinadi.
 *
 * Ishlatish:
 *   node scripts/check-patients.mjs +998901234567
 *   node scripts/check-patients.mjs +998901234567 --raw   # to'liq JSON
 *
 * Skript hech narsa o'zgartirmaydi — faqat o'qiydi.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { clientConfig, explainMissingTable, printTarget, PREFIX as prefix } from './aws-env.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig()));
const table = `${prefix}_individuals`;

const args = process.argv.slice(2);
const raw = args.includes('--raw');
const input = args.find((a) => !a.startsWith('--'));

if (!input) {
  console.error('Telefon raqamini bering. Masalan:\n  node scripts/check-patients.mjs +998901234567');
  process.exit(1);
}

/** Sayt ishlatadigan format bilan bir xil: +998XXXXXXXXX. */
const normalize = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('998') ? `+${digits}` : `+998${digits.slice(-9)}`;
};

const phone = normalize(input);
printTarget();
console.log(`Telefon: ${phone}\n`);

/** Telefon bo'yicha barcha yozuvlar (sahifalab, oxirigacha). */
async function readAll(key) {
  const items = [];
  let startKey;
  do {
    const page = await db
      .send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: 'phone = :p',
          ExpressionAttributeValues: { ':p': key },
          ExclusiveStartKey: startKey,
        }),
      )
      .catch(explainMissingTable(table));
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

const rows = await readAll(phone);

if (!rows.length) {
  console.log('Bu telefon ostida 1C yozuvi yo‘q.\n');
} else {
  console.log(`${rows.length} ta yozuv topildi:\n`);
  for (const one of rows) {
    const name =
      one.FullName?.trim() ||
      [one.Surname, one.Name, one.Patronymic].filter(Boolean).join(' ') ||
      '(ismsiz)';
    const code = one.sort_key !== 'PROFILE' ? one.sort_key : one.Code;
    const flags = [
      one.DeletionMark === true ? 'O‘CHIRISHGA BELGILANGAN — saytda ko‘rinmaydi' : null,
      !name || name === '(ismsiz)' ? 'ismsiz — saytda ko‘rinmaydi' : null,
      one.Birthday ? null : 'tug‘ilgan sanasi yo‘q — bron oldidan so‘raladi',
    ].filter(Boolean);

    console.log(`  ${name}`);
    console.log(`    sort_key: ${one.sort_key ?? '—'}${code && code !== one.sort_key ? ` · Code: ${code}` : ''}`);
    console.log(`    tug‘ilgan: ${one.Birthday ?? '—'}`);
    if (flags.length) console.log(`    ⚠ ${flags.join('; ')}`);
    if (raw) console.log(`    ${JSON.stringify(one)}`);
  }
  console.log();
}

/*
  Eng ko'p uchraydigan sabab: 1C telefonni boshqa formatda yozgan.
  Kalit — aynan satr, ya'ni "998901234567" va "+998901234567" ikki
  xil bemor bo'lib qoladi. Shuning uchun oxirgi 9 raqami mos keladigan
  boshqa kalitlarni ham qidiramiz.
*/
const tail = phone.slice(-9);
const { Items: all = [] } = await db
  .send(new ScanCommand({ TableName: table, ProjectionExpression: 'phone, sort_key' }))
  .catch(explainMissingTable(table));

const others = [...new Set(all.map((i) => i.phone))].filter(
  (p) => typeof p === 'string' && p !== phone && p.replace(/\D/g, '').endsWith(tail),
);

if (others.length) {
  console.log('⚠ Shu raqamning boshqa formatdagi kalitlari ham bor:');
  for (const other of others) {
    const n = all.filter((i) => i.phone === other).length;
    console.log(`    "${other}" — ${n} ta yozuv (sayt bularni ko‘rmaydi)`);
  }
  console.log('\n  1C har doim "+998XXXXXXXXX" formatida yozishi kerak.\n');
}

const shown = rows.filter(
  (one) =>
    one.DeletionMark !== true &&
    (one.FullName?.trim() || [one.Surname, one.Name, one.Patronymic].filter(Boolean).join(' ')),
).length;
console.log(`Saytdagi ro‘yxatda ko‘rinadi: ${shown} ta (1C yozuvlaridan).`);
console.log('Bunga saytning o‘zida qo‘shilgan oila a‘zolari ham qo‘shiladi.');
