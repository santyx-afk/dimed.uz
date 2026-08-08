import type { Context } from '@netlify/functions';
import { timingSafeEqual } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { db, TABLES } from './lib/db.ts';
import { required, optional, AWS_REGION } from './lib/env.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { json, error, normalizePhone } from './lib/http.ts';

/**
 * 1C laboratoriya tizimidan tahlil natijalarini qabul qiladi.
 * Matn natija DynamoDB'ga, PDF esa S3'ga yoziladi.
 *
 * Spetsifikatsiya: docs/1c-integration.md
 */

type ResultItem = {
  code: string;
  title: string;
  /** Matn natija, masalan "5,2 mmol/L" */
  value?: string;
  reference?: string;
  /** PDF base64 ko'rinishida (ixtiyoriy) */
  pdf_base64?: string;
};

type Body = {
  phone?: string;
  order_id?: string;
  date?: string;
  results?: ResultItem[];
};

const s3 = new S3Client({ region: AWS_REGION });

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

    const phone = normalizePhone(body.phone);
    const date = body.date ?? new Date().toISOString();
    const bucket = optional('LAB_S3_BUCKET');

    for (const item of body.results) {
      let s3Key: string | undefined;

      if (item.pdf_base64) {
        if (!bucket) throw new Error('LAB_S3_BUCKET sozlanmagan — PDF saqlab bo‘lmadi');
        s3Key = `results/${encodeURIComponent(phone)}/${date.slice(0, 10)}/${item.code}.pdf`;
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: Buffer.from(item.pdf_base64, 'base64'),
            ContentType: 'application/pdf',
          }),
        );
      }

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
            type: s3Key ? 'pdf' : 'text',
            s3_key: s3Key,
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
