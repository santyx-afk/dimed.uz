import type { Context } from '@netlify/functions';
import { clearSessionCookie } from './lib/session.ts';
import { json, error } from './lib/http.ts';

/**
 * POST /api/logout — sessiyani tugatadi.
 * Cookie HttpOnly bo'lgani uchun uni faqat server o'chira oladi.
 */
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return error('Faqat POST', 405);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
};
