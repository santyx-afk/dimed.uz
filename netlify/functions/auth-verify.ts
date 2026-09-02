import type { Context } from '@netlify/functions';
import { timingSafeEqual } from 'node:crypto';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { createSessionCookie } from './lib/session.ts';
import { mergeIndividualProfile } from './lib/patients.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error, normalizePhone } from './lib/http.ts';

type Body = { phone?: string; code?: string };

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return error('Faqat POST', 405);

  try {
    const body = (await request.json()) as Body;
    if (!body.phone || !body.code) return error('Telefon raqami va kod kerak');

    const phone = normalizePhone(body.phone);
    const given = body.code.replace(/\D/g, '');
    if (given.length !== 6) return error('Kod 6 xonali bo‘lishi kerak');

    const found = await db.send(new GetCommand({ TableName: TABLES.otpCodes, Key: { phone } }));
    const record = found.Item as
      | { code: string; telegram_id: string; expires_at: number }
      | undefined;

    // TTL o'chirishi kechikishi mumkin — muddatni o'zimiz ham tekshiramiz.
    if (!record || record.expires_at < Math.floor(Date.now() / 1000)) {
      return error('Kod eskirgan. Botdan yangi kod oling.', 401);
    }

    const a = Buffer.from(record.code);
    const b = Buffer.from(given);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return error('Kod noto‘g‘ri.', 401);
    }

    // Kod bir marta ishlatiladi.
    await db.send(new DeleteCommand({ TableName: TABLES.otpCodes, Key: { phone } }));

    // Har kirishda 1C profili yangilanadi — 1C keyin yozgan bo'lsa ham
    // yetib keladi. Bu qulaylik, kirish sharti emas.
    await mergeIndividualProfile(phone, record.telegram_id).catch((err) =>
      logToAdmin('auth-verify/1c-profil', err),
    );

    return json(
      { ok: true },
      200,
      { 'set-cookie': createSessionCookie({ phone, userId: record.telegram_id }) },
    );
  } catch (err) {
    await logToAdmin('auth-verify', err);
    return error('Tizimda xatolik. Birozdan so‘ng urinib ko‘ring.', 500);
  }
};
