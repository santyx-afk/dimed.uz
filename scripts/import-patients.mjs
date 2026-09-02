/**
 * 1C'dan chiqarilgan bemorlar ro'yxatini (CSV) dimed_users ga yuklaydi.
 *
 * Tez yo'l: 1C'da "Jismoniy shaxslar" ro'yxatini faylga chiqarasiz
 * (Вывести список → saqlash), shu skript telefonni bot foydalanuvchisi
 * bilan solishtirib, 1C profilini yozadi. 1C dasturchisi kerak emas.
 *
 * Bemor botga hali kirmagan bo'lsa — yozuv ochilmaydi (jadval kaliti
 * telegram_id, u faqat botdan keladi). Bunday qatorlar sanab
 * ko'rsatiladi; bemor keyin botga kirsa, skriptni qayta yurgizish
 * kifoya — u idempotent.
 *
 * Ishlatish:
 *   node scripts/import-patients.mjs bemorlar.csv          # yuklash
 *   node scripts/import-patients.mjs bemorlar.csv --dry    # faqat ko'rish
 *
 * Ustunlar sarlavhadan avtomatik topiladi (o'zbek/rus/ingliz nomlar):
 * kod, familiya, ism, sharif, to'liq ism, jins, tug'ilgan kun,
 * telefon (majburiy), email. Ajratgich: `,` `;` yoki TAB.
 */
import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { clientConfig, explainMissingTable, printTarget, PREFIX as prefix } from './aws-env.mjs';

const usersTable = `${prefix}_users`;
const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig()), {
  marshallOptions: { removeUndefinedValues: true },
});

const die = (message) => {
  console.error(`Xato: ${message}`);
  process.exit(1);
};

// --- faylni o'qish ---
// 1C Windows'da ba'zan windows-1251 da saqlaydi. UTF-8 deb o'qib
// ko'ramiz; buzuq belgilar chiqsa 1251 ga qaytamiz.
function decode(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1251').decode(buf);
}

/** Oddiy CSV: qo'shtirnoqli maydonlar, `,` `;` yoki TAB ajratgich. */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.slice(0, clean.indexOf('\n') + 1 || undefined);
  const delimiter = [';', '\t', ','].find(
    (d) => (firstLine.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) ?? []).length > 0,
  ) ?? ',';

  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

// --- ustunlarni topish ---
// Tartib muhim: "to'liq ism" dagi "ism" so'zi oddiy ismdan oldin
// tekshiriladi, "tug'ilgan kuni" esa "tug'ilgan joyi" bilan
// adashmasligi uchun "kun" ham talab qilinadi.
const COLUMNS = [
  ['full_name', /to.?liq|полн|full/i],
  ['birth_date', /(tug|рожд|birth).*(kun|дат|date)|дата рожд/i],
  ['code', /^(kod|code|код)/i],
  ['last_name', /famil|фамил|last/i],
  ['patronymic', /sharif|otchestv|отчеств|patronym/i],
  ['first_name', /^ism|имя|first/i],
  ['gender', /jins|пол\b|gender|sex/i],
  ['phone', /tel|тел|phone/i],
  ['email', /mail|почта/i],
];

export function mapHeader(header) {
  const map = {};
  header.forEach((raw, i) => {
    const title = raw.trim();
    for (const [field, re] of COLUMNS) {
      if (map[field] === undefined && re.test(title)) { map[field] = i; return; }
    }
  });
  return map;
}

/** http.ts dagi bilan bir xil qoida — bazada telefon shu ko'rinishda. */
const normalizePhone = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.startsWith('998') ? `+${digits}` : `+998${digits.slice(-9)}`;
};

const normalizeGender = (raw) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (/^(erkak|муж|male|m|э)/.test(v)) return 'male';
  if (/^(ayol|жен|female|f|а)/.test(v)) return 'female';
  return null;
};

/** 25.04.1990 yoki 1990-04-25 → 1990-04-25 */
const normalizeBirthDate = (raw) => {
  const v = String(raw ?? '').trim();
  let m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  return null;
};

/** Bitta CSV qatoridan bazaga yoziladigan profil. */
export function profileFrom(row, map) {
  const cell = (field) => (map[field] === undefined ? '' : String(row[map[field]] ?? '').trim());

  const phone = normalizePhone(cell('phone'));
  const profile = {};
  if (cell('code')) profile.code = cell('code');
  if (cell('last_name')) profile.last_name = cell('last_name');
  if (cell('first_name')) profile.first_name = cell('first_name');
  if (cell('patronymic')) profile.patronymic = cell('patronymic');
  const gender = normalizeGender(cell('gender'));
  if (gender) profile.gender = gender;
  const birth = normalizeBirthDate(cell('birth_date'));
  if (birth) profile.birth_date = birth;
  if (cell('email')) profile.email = cell('email');

  profile.full_name =
    cell('full_name') ||
    [profile.last_name, profile.first_name, profile.patronymic].filter(Boolean).join(' ');
  if (!profile.full_name) delete profile.full_name;

  return { phone, profile };
}

// To'g'ridan-to'g'ri chaqirilganda ishlaydi; testlar faqat import qiladi.
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const [file, ...flags] = process.argv.slice(2);
  const dry = flags.includes('--dry');
  if (!file) {
    die("fayl ko'rsatilmadi.\n  node scripts/import-patients.mjs bemorlar.csv [--dry]");
  }

  printTarget();

  let rows;
  try {
    rows = parseCsv(decode(readFileSync(file)));
  } catch (err) {
    die(`faylni o'qib bo'lmadi: ${err.message}`);
  }
  if (rows.length < 2) die('faylda sarlavha va kamida bitta qator bo\'lishi kerak');

  const map = mapHeader(rows[0]);
  if (map.phone === undefined) {
    die(
      'telefon ustuni topilmadi. Sarlavha: ' + rows[0].join(' | ') +
      '\n  Ustun nomida "telefon" so\'zi bo\'lishi kerak.',
    );
  }
  const topilgan = COLUMNS.map(([f]) => f).filter((f) => map[f] !== undefined);
  console.log(`Ustunlar topildi: ${topilgan.join(', ')}`);
  if (dry) console.log('--dry: bazaga hech narsa yozilmaydi.\n');

  let yangilandi = 0, botsiz = 0, telefonsiz = 0;
  const botsizlar = [];
  const seen = new Set();

  for (const row of rows.slice(1)) {
    const { phone, profile } = profileFrom(row, map);
    if (!phone) { telefonsiz++; continue; }
    // Bir telefon ikki qatorda kelsa (masalan, ota-ona va bola),
    // faqat birinchisi olinadi — qolganini qo'lda hal qilish kerak.
    if (seen.has(phone)) { console.log(`  ! ${phone} takror — o'tkazib yuborildi`); continue; }
    seen.add(phone);

    const { Items = [] } = await db
      .send(new QueryCommand({
        TableName: usersTable,
        IndexName: 'phone-index',
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
        Limit: 1,
      }))
      .catch(explainMissingTable(usersTable));

    if (Items.length === 0) {
      botsiz++;
      if (botsizlar.length < 10) botsizlar.push(`${profile.full_name ?? '?'} (${phone})`);
      continue;
    }

    if (!dry) {
      const fields = Object.entries(profile);
      if (fields.length === 0) continue;
      const names = { '#upd': 'updated_at' };
      const values = { ':upd': new Date().toISOString() };
      const sets = fields.map(([k, v], i) => {
        names[`#f${i}`] = k;
        values[`:v${i}`] = v;
        return `#f${i} = :v${i}`;
      });
      await db.send(new UpdateCommand({
        TableName: usersTable,
        Key: { telegram_id: Items[0].telegram_id },
        UpdateExpression: `SET ${sets.join(', ')}, #upd = :upd`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }));
    }
    yangilandi++;
    console.log(`  + ${profile.full_name ?? phone} → ${phone}`);
  }

  console.log(`\n${dry ? 'Yozilardi' : 'Yangilandi'}: ${yangilandi} ta`);
  if (botsiz) {
    console.log(`Botga hali kirmagan: ${botsiz} ta — ular botga kirgach skriptni qayta yurgizing.`);
    for (const b of botsizlar) console.log(`    ${b}`);
    if (botsiz > botsizlar.length) console.log(`    ... va yana ${botsiz - botsizlar.length} ta`);
  }
  if (telefonsiz) console.log(`Telefonsiz qator: ${telefonsiz} ta — o'tkazib yuborildi.`);
}
