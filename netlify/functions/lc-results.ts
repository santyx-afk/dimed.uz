import type { Context } from '@netlify/functions';
import { timingSafeEqual } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { required } from './lib/env.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { json, error, normalizePhone } from './lib/http.ts';
import { botText, isLang } from './lib/i18n.ts';
import { siteOrigin } from './result.ts';

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

    await notifyPatient(phone, body.results, date, request);
    return json({ ok: true, saved: body.results.length });
  } catch (err) {
    await logToAdmin('lc-results', err);
    return error('Natijalarni saqlab bo‘lmadi', 500);
  }
};

/**
 * Bemorga xabar — natija sahifasi havolasi bilan (G1). Bot xatosi
 * natijalarni saqlashni bekor qilmaydi. Sayt yozgan natijalar bir
 * sanaga "lab-<sana>" guruhi bo'lib yig'iladi — havola shunga.
 */
async function notifyPatient(
  phone: string,
  results: ResultItem[],
  date: string,
  request: Request,
): Promise<void> {
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

    const user = users.Items?.[0] as { telegram_id?: string; lang?: string } | undefined;
    if (!user?.telegram_id) return;

    const lang = isLang(user.lang) ? user.lang : 'uz';
    const first = results[0];
    const title =
      results.length === 1 && first ? first.title : `${first?.title ?? 'Tahlil'} +${results.length - 1}`;
    await sendMessage(
      user.telegram_id,
      botText('result.ready', lang, {
        title,
        date: date.slice(0, 10),
        link: `${siteOrigin(request)}/natija?id=${encodeURIComponent(`lab-${date}`)}`,
      }),
    );
  } catch (err) {
    await logToAdmin('lc-results/notify', err);
  }
}
