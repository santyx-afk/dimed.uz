import { createHmac, timingSafeEqual, randomInt } from 'node:crypto';
import { required } from './env.ts';

const COOKIE_NAME = 'dimed_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 kun

export type Session = { phone: string; userId: string; exp: number };

const b64url = (buf: Buffer): string => buf.toString('base64url');

function sign(payload: string): string {
  return b64url(createHmac('sha256', required('SESSION_SECRET')).update(payload).digest());
}

export function createSessionCookie(session: Omit<Session, 'exp'>): string {
  const full: Session = { ...session, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const payload = b64url(Buffer.from(JSON.stringify(full)));
  const token = `${payload}.${sign(payload)}`;

  return [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join('; ');
}

/** Cookie'dagi sessiyani tekshiradi. Yaroqsiz bo'lsa — null. */
export function readSession(cookieHeader: string | undefined): Session | null {
  const raw = cookieHeader
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;

  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;

  const payload = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    return session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

/** 6 xonali OTP kod (kriptografik tasodifiy). */
export const generateOtp = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
