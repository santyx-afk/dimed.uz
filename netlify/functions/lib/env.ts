/** Muhit o'zgaruvchilari. Yo'q bo'lsa — darhol tushunarli xato. */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Muhit o'zgaruvchisi sozlanmagan: ${name}`);
  return value;
}

export const optional = (name: string, fallback = ''): string => process.env[name] ?? fallback;

export const AWS_REGION = optional('DIMED_AWS_REGION', 'eu-central-1');
export const TABLE_PREFIX = optional('DIMED_TABLE_PREFIX', 'dimed');

/**
 * AWS kalitlari.
 *
 * Netlify `AWS_ACCESS_KEY_ID` va `AWS_SECRET_ACCESS_KEY` nomlarini
 * o'zi band qilgan — ularni sozlamalarga qo'shib bo'lmaydi. Shuning
 * uchun `DIMED_` prefiksli nomlar ishlatiladi. Standart nomlar ham
 * qabul qilinadi: lokal ishlash va testlar uchun.
 *
 * Ikkalasi ham yo'q bo'lsa `undefined` qaytadi — shunda SDK o'zining
 * odatdagi zanjiriga tayanadi (CloudShell, IAM rol, ~/.aws/credentials).
 */
export function awsCredentials(): { accessKeyId: string; secretAccessKey: string } | undefined {
  const accessKeyId = optional('DIMED_AWS_ACCESS_KEY_ID') || optional('AWS_ACCESS_KEY_ID');
  const secretAccessKey =
    optional('DIMED_AWS_SECRET_ACCESS_KEY') || optional('AWS_SECRET_ACCESS_KEY');

  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
}

export const tableName = (name: string): string => `${TABLE_PREFIX}_${name}`;
