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
 * qabul qilinadi: lokal ishlash, CloudShell va testlar uchun.
 *
 * `trim` — Netlify paneliga nusxalashda qiymat oxiriga probel yoki
 * qator ilashib qolishi mumkin, bu esa ko'zga ko'rinmaydigan xato.
 *
 * **Lambda ichida zaxira nomlarga tayanmaymiz.** Netlify funksiyalari
 * AWS Lambda ustida ishlaydi va Lambda o'zining *vaqtinchalik*
 * kalitlarini shu standart nomlarga qo'yadi. Ular `AWS_SESSION_TOKEN`
 * bilan birga ishlatilishi shart; tokensiz AWS ularni rad etadi va
 * "The security token included in the request is invalid" degan
 * chalg'ituvchi xato chiqadi — aslida sabab: `DIMED_` o'zgaruvchilari
 * sozlanmagan. Shuning uchun bu holatda darhol tushunarli xato beramiz.
 */
export function awsCredentials(): { accessKeyId: string; secretAccessKey: string } | undefined {
  const accessKeyId = optional('DIMED_AWS_ACCESS_KEY_ID').trim();
  const secretAccessKey = optional('DIMED_AWS_SECRET_ACCESS_KEY').trim();
  if (accessKeyId && secretAccessKey) return { accessKeyId, secretAccessKey };

  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const missing = [
      accessKeyId ? '' : 'DIMED_AWS_ACCESS_KEY_ID',
      secretAccessKey ? '' : 'DIMED_AWS_SECRET_ACCESS_KEY',
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `Netlify'da sozlanmagan: ${missing}. Sozlangan bo'lsa — "Scopes" ` +
        `ro'yxatida Functions belgilanganini va o'zgarishdan keyin ` +
        `Trigger deploy qilinganini tekshiring.`,
    );
  }

  // Lokal ishlash, CloudShell, testlar.
  const fallbackId = optional('AWS_ACCESS_KEY_ID').trim();
  const fallbackSecret = optional('AWS_SECRET_ACCESS_KEY').trim();
  return fallbackId && fallbackSecret
    ? { accessKeyId: fallbackId, secretAccessKey: fallbackSecret }
    : undefined;
}

export const tableName = (name: string): string => `${TABLE_PREFIX}_${name}`;
