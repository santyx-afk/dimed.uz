import type { Context } from '@netlify/functions';
import { timingSafeEqual } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { required } from './lib/env.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { json, error, normalizePhone } from './lib/http.ts';

/**
 * 1C laboratoriya tizimidan tahlil natijalarini qabul qiladi.
 *
 * Faqat matn natija olinadi — PDF fayl qabul qilinmaydi: bemor
 * kabinetning o'zida "PDF" tugmasi bilan chiroyli blankni brauzerda
 * yasab oladi. Shu sababli S3 ham, fayl saqlash ham kerak emas.
 *
 * Spetsifikatsiya: docs/1c-integration.md
 */

type ResultItem = {
  code: string;
  title: string;
  /** Matn natija, masalan "5,2 mmol/L" */
  value?: string;
  reference?: string;
};

type Body = {
  phone?: string;
  order_id?: string;
  date?: string;
  results?: ResultItem[];
};

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return error('Faqat POST', 405);

  const given = Buffer.from(request.headers.get('x-api-key') ?? '');
  const expected = Buffer.from(required('LC_API_KEY'));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return error('API kalit noto‘g‘ri', 401);
  }

  try {
    const body = (await request.json()) as Body;
    if (!body.phone) return error('phone maydoni kerak');
    if (!body.results?.length) return error('results ro‘yxati bo‘sh');

    for (const item of body.results) {
      if (!item.code || !item.title) return error('Har bir natijada code va title kerak');
      if (!item.value) return error(`"${item.title}": value maydoni kerak (matn natija)`);
    }

    const phone = normalizePhone(body.phone);
    const date = body.date ?? new Date().toISOString();

    for (const item of body.results) {
      await db.send(
        new PutCommand({
          TableName: TABLES.labResults,
          Item: {
            phone,
            sort_key: `${date}#${item.code}`,
            code: item.code,
            title: item.title,
            value: item.value,
            reference: item.reference,
            type: 'text',
            order_id: body.order_id,
            date,
            seen: false,
          },
        }),
      );
    }

    await notifyPatient(phone, body.results.length);
    return json({ ok: true, saved: body.results.length });
  } catch (err) {
    await logToAdmin('lc-results', err);
    return error('Natijalarni saqlab bo‘lmadi', 500);
  }
};

/** Bemorga xabar. Bot xatosi natijalarni saqlashni bekor qilmaydi. */
async function notifyPatient(phone: string, count: number): Promise<void> {
  try {
    const users = await db.send(
      new QueryCommand({
        TableName: TABLES.users,
        IndexName: 'phone-index',
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
        Limit: 1,
      }),
    );

    const telegramId = (users.Items?.[0] as { telegram_id?: string } | undefined)?.telegram_id;
    if (!telegramId) return;

    await sendMessage(
      telegramId,
      `🧪 <b>Tahlil natijangiz tayyor</b>\n\n${count} ta natija shaxsiy kabinetingizga yuklandi:\nhttps://dimed.uz/kabinet`,
    );
  } catch (err) {
    await logToAdmin('lc-results/notify', err);
  }
}
