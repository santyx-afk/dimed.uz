import type { Context } from '@netlify/functions';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { sessionFrom } from './lib/auth.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * /api/settings — bemor sozlamalari (kabinet → Sozlamalar, C1).
 *
 * GET  — { lang }
 * POST — { lang: 'uz' | 'ru' | 'en' }
 *
 * Til bemor yozuvida saqlanadi: bot xabarlari (tahlil tayyor, baho
 * so'rovi) shu tilda boradi; sayt esa brauzerdagi tanlovni ishlatadi.
 */
const LANGS = ['uz', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];
const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export default async (request: Request, _context: Context): Promise<Response> => {
  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);

  try {
    if (request.method === 'GET') {
      const found = await db.send(
        new GetCommand({ TableName: TABLES.users, Key: { telegram_id: session.userId } }),
      );
      const user = found.Item as { lang?: string } | undefined;
      return json({ lang: isLang(user?.lang) ? user.lang : 'uz' }, 200, {
        'cache-control': 'private, no-store',
      });
    }

    if (request.method !== 'POST') return error('Faqat GET yoki POST', 405);

    const body = (await request.json().catch(() => ({}))) as { lang?: unknown };
    if (!isLang(body.lang)) return error(`lang ${LANGS.join(', ')} dan biri bo‘lishi kerak`);

    await db.send(
      new UpdateCommand({
        TableName: TABLES.users,
        Key: { telegram_id: session.userId },
        UpdateExpression: 'SET lang = :l, updated_at = :u',
        ExpressionAttributeValues: { ':l': body.lang, ':u': new Date().toISOString() },
      }),
    );
    return json({ ok: true, lang: body.lang });
  } catch (err) {
    await logToAdmin('settings', err);
    return error('Sozlamani saqlab bo‘lmadi', 500);
  }
};
