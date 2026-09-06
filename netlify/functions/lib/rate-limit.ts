import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';
import { logToAdmin } from './telegram.ts';
import { error } from './http.ts';

/**
 * So'rovlar sonini cheklash.
 *
 * Kalit "nima#kim" (masalan `kirish#+998901234567`), oyna — sekundlarda.
 * Har oyna uchun alohida yozuv ochiladi va TTL bilan o'zi o'chadi.
 *
 * Jadval hali yaratilmagan bo'lsa cheklov ishlamaydi, lekin sayt
 * to'xtamaydi: yopiq turgan eshikdan ko'ra ochiq eshik afzal emas —
 * ammo cheklov tufayli hamma bemorni ichkariga kiritmay qo'yish
 * undan ham yomon. Shuning uchun xatoda o'tkazib yuboriladi va
 * sabab log-botga boradi.
 */
export type LimitResult = { ok: true } | { ok: false; retryAfter: number };

export async function hitLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<LimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expiresAt = windowStart + windowSeconds;

  try {
    const res = await db.send(
      new UpdateCommand({
        TableName: TABLES.rateLimits,
        Key: { bucket: `${key}#${windowStart}` },
        UpdateExpression: 'SET hits = if_not_exists(hits, :zero) + :one, expires_at = :exp',
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':exp': expiresAt },
        ReturnValues: 'ALL_NEW',
      }),
    );
    const hits = Number((res.Attributes as { hits?: number } | undefined)?.hits ?? 0);
    return hits > max ? { ok: false, retryAfter: expiresAt - now } : { ok: true };
  } catch (err) {
    await logToAdmin('rate-limit', err);
    return { ok: true };
  }
}

/** Cheklovga urilgan so'rovga javob. */
export const tooMany = (retryAfter: number): Response =>
  error(
    `Juda ko‘p urinish. ${Math.max(1, Math.ceil(retryAfter / 60))} daqiqadan so‘ng qayta urinib ko‘ring.`,
    429,
  );

/** Netlify so'rovdagi mijoz IP si (cheklov uchun; topilmasa "-"). */
export const clientIp = (request: Request): string =>
  request.headers.get('x-nf-client-connection-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  '-';
