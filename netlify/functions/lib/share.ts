import { createHmac, timingSafeEqual } from 'node:crypto';
import { required } from './env.ts';

/**
 * Natija sahifasi uchun ulashish havolasi (D1 "Ulashish").
 *
 * Havola imzolangan token oladi: ichida telefon, hujjat id va muddat.
 * Token bilan kirish sessiya talab qilmaydi — bemor havolani shifokor
 * yoki qarindoshiga yuborishi mumkin. Muddati 30 kun; imzo
 * SESSION_SECRET bilan (sessiya cookie'si kabi).
 */
export type SharePayload = { phone: string; id: string; exp: number };

const SHARE_DAYS = 30;

const b64url = (buf: Buffer): string => buf.toString('base64url');
const sign = (payload: string): string =>
  b64url(createHmac('sha256', `share:${required('SESSION_SECRET')}`).update(payload).digest());

export function createShareToken(phone: string, id: string, days = SHARE_DAYS): string {
  const full: SharePayload = { phone, id, exp: Math.floor(Date.now() / 1000) + days * 86_400 };
  const payload = b64url(Buffer.from(JSON.stringify(full)));
  return `${payload}.${sign(payload)}`;
}

/** Tokenni tekshiradi; yaroqsiz yoki muddati o'tgan bo'lsa — null. */
export function readShareToken(token: string | null | undefined): SharePayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SharePayload;
    if (!data.phone || !data.id || typeof data.exp !== 'number') return null;
    return data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
}
