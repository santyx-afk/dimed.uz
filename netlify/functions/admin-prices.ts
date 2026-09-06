import type { Context } from '@netlify/functions';
import { ScanCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { sessionFrom, isAdmin, type DoctorRecord } from './lib/auth.ts';
import { toAnalysisPrice, type PriceRow } from './prices.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * Admin — narxlar bo'limi (F2).
 *
 *   GET  /api/admin-prices — tahlil narxlari (faolsizlari ham) va shifokorlar
 *   POST /api/admin-prices
 *        { kind: 'analysis', code, title, group?, duration?, price, active? }
 *        { kind: 'doctor', id, price }
 *
 * Tahlil yozuvi bazada bo'lmasa (hali seed qilinmagan) — POST uni
 * yaratadi: sahifadagi statik ro'yxat shu tarzda bazaga ko'chadi.
 */
const MAX_PRICE = 100_000_000;

type Body = {
  kind?: string;
  code?: string;
  title?: string;
  group?: string;
  duration?: string;
  price?: unknown;
  active?: unknown;
  id?: string;
};

const cleanText = (v: unknown, max = 120): string =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';

const checkPrice = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_PRICE ? v : null;

export default async (request: Request, _context: Context): Promise<Response> => {
  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);
  if (!isAdmin(session)) {
    return json({ error: 'Bu bo‘lim faqat administrator uchun', telegramId: session.userId }, 403);
  }

  try {
    if (request.method === 'GET') return await list();
    if (request.method === 'POST') return await save((await request.json().catch(() => ({}))) as Body);
    return error('Faqat GET yoki POST', 405);
  } catch (err) {
    await logToAdmin('admin-prices', err);
    return error('Narxlarni boshqarishda xatolik', 500);
  }
};

async function list(): Promise<Response> {
  const [priceRows, doctorRows] = await Promise.all([
    db
      .send(new ScanCommand({ TableName: TABLES.prices }))
      .then((r) => (r.Items ?? []) as PriceRow[])
      .catch(async (err) => {
        await logToAdmin('admin-prices/jadval', err);
        return [] as PriceRow[];
      }),
    db.send(new ScanCommand({ TableName: TABLES.doctors })).then((r) => (r.Items ?? []) as DoctorRecord[]),
  ]);

  return json(
    {
      analyses: priceRows.filter((r) => r.kind === 'analysis' && r.code).map(toAnalysisPrice),
      doctors: doctorRows
        .map((d) => ({ id: d.doctor_id, name: d.name, job: d.job, price: d.price, active: d.active !== false }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
    200,
    { 'cache-control': 'private, no-store' },
  );
}

async function save(body: Body): Promise<Response> {
  const price = checkPrice(body.price);
  if (price === null) return error('Narx butun musbat son bo‘lishi kerak (so‘mda)');
  const now = new Date().toISOString();

  if (body.kind === 'doctor') {
    const id = cleanText(body.id, 40);
    if (!id) return error('Shifokor id kerak');
    try {
      await db.send(
        new UpdateCommand({
          TableName: TABLES.doctors,
          Key: { doctor_id: id },
          UpdateExpression: 'SET price = :p, updated_at = :u',
          ConditionExpression: 'attribute_exists(doctor_id)',
          ExpressionAttributeValues: { ':p': price, ':u': now },
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return error('Bunday shifokor yo‘q', 404);
      throw err;
    }
    return json({ ok: true, kind: 'doctor', id, price });
  }

  if (body.kind === 'analysis') {
    const code = cleanText(body.code, 20);
    const title = cleanText(body.title);
    if (!code || !/^[\w.-]+$/.test(code)) return error('Tahlil kodi kerak');
    if (!title) return error('Tahlil nomi kerak');

    const item: PriceRow = {
      item_id: `analysis#${code}`,
      kind: 'analysis',
      code,
      title,
      group: cleanText(body.group),
      duration: cleanText(body.duration, 40),
      price,
      active: body.active !== false,
      updated_at: now,
    };
    await db.send(new PutCommand({ TableName: TABLES.prices, Item: item }));
    return json({ ok: true, kind: 'analysis', item: toAnalysisPrice(item) });
  }

  return error('kind analysis yoki doctor bo‘lishi kerak');
}
