export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const error = (message: string, status = 400): Response => json({ error: message }, status);

/*
  Telefon raqami bilan ishlash `lib/phone.ts` da — u har xil yozilishni
  (bo'sh joy, chiziqcha, mamlakat kodi bilan yoki usiz) tushunadi va
  noto'g'risini rad etadi. Bu yerdan qayta chiqariladi: mavjud
  importlar o'zgarmasin.
*/
export { normalizePhone, parsePhone, formatPhone, phoneVariants } from './phone.ts';
