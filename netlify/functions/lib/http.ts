export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const error = (message: string, status = 400): Response => json({ error: message }, status);

/** Telefon raqamini +998XXXXXXXXX ko'rinishiga keltiradi. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('998') ? `+${digits}` : `+998${digits.slice(-9)}`;
}
