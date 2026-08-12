import type { Context } from '@netlify/functions';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, TABLES } from './lib/db.ts';
import { s3 } from './lib/s3.ts';
import { sessionFrom } from './lib/auth.ts';
import { required } from './lib/env.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

const LINK_TTL_SECONDS = 5 * 60;

/**
 * GET /api/result-file?id=<sort_key>
 * Tahlil PDF'iga vaqtinchalik havola. Fayl faqat o'z egasiga ochiladi —
 * S3 bucket'i ommaviy emas.
 */
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return error('Faqat GET', 405);

  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return error('id parametri kerak');

  try {
    // Kalitda bemor telefoni bor — boshqa bemorning fayliga yetib bo'lmaydi.
    const found = await db.send(
      new GetCommand({
        TableName: TABLES.labResults,
        Key: { phone: session.phone, sort_key: id },
      }),
    );
    const result = found.Item as { s3_key?: string; title?: string } | undefined;

    if (!result) return error('Natija topilmadi', 404);
    if (!result.s3_key) return error('Bu natijada fayl yo‘q', 404);

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: required('LAB_S3_BUCKET'), Key: result.s3_key }),
      { expiresIn: LINK_TTL_SECONDS },
    );

    return json({ url, title: result.title ?? '', expiresIn: LINK_TTL_SECONDS }, 200, {
      'cache-control': 'private, no-store',
    });
  } catch (err) {
    await logToAdmin('result-file', err);
    return error('Faylni ochishda xatolik', 500);
  }
};
