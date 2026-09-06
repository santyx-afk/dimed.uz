/**
 * O'zbekiston telefon raqami: o'qish, tekshirish va ko'rsatish.
 *
 * Odamlar raqamni har xil yozadi — bo'sh joy bilan, chiziqcha bilan,
 * qavs bilan, mamlakat kodi bilan yoki usiz:
 *
 *   90 123 45 67 · 901234567 · 90 123 4567 · (90) 123-45-67
 *   +998 90 123 45 67 · 998901234567 · 00998901234567 · 8 998 901 234 567
 *
 * Hammasi bitta ko'rinishga keltiriladi: +998XXXXXXXXX. Baza kaliti
 * ham shu — format farq qilsa bemor "boshqa odam" bo'lib qoladi.
 *
 * Operator kodi tekshirilmaydi: yangi kodlar chiqib turadi va eskisi
 * ham ishlayveradi. Faqat uzunlik va boshlanishi tekshiriladi.
 */
export const COUNTRY_CODE = '998';

/** Mamlakat kodidan keyingi raqamlar soni. */
const NATIONAL_LENGTH = 9;

export type PhoneResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Raqamdan milliy qismni (9 xona) ajratadi.
 * Tanimasa — null.
 */
function nationalPart(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // 00998… (xalqaro prefiks) va 8998… (rus uslubidagi tashqi chiqish)
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 1 + COUNTRY_CODE.length + NATIONAL_LENGTH && digits.startsWith('8' + COUNTRY_CODE)) {
    digits = digits.slice(1);
  }
  if (digits.startsWith(COUNTRY_CODE) && digits.length === COUNTRY_CODE.length + NATIONAL_LENGTH) {
    digits = digits.slice(COUNTRY_CODE.length);
  }

  return digits.length === NATIONAL_LENGTH ? digits : null;
}

/**
 * Raqamni tekshirib, +998XXXXXXXXX ko'rinishida qaytaradi.
 * Xato bo'lsa sababini aytadi — foydalanuvchiga ko'rsatish uchun.
 */
export function parsePhone(raw: unknown): PhoneResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Telefon raqamini kiriting' };
  }

  const national = nationalPart(raw);
  if (!national) {
    return { ok: false, error: 'Telefon raqami toʻliq emas — 9 xonali raqam kiriting (masalan 90 123 45 67)' };
  }
  if (national.startsWith('0')) {
    return { ok: false, error: 'Telefon raqami notoʻgʻri — operator kodi 0 bilan boshlanmaydi' };
  }

  return { ok: true, value: `+${COUNTRY_CODE}${national}` };
}

/** Tekshirmasdan keltiradi (eski yozuvlar uchun); tanilmasa — raqamlarning o'zi. */
export function normalizePhone(raw: string): string {
  const parsed = parsePhone(raw);
  if (parsed.ok) return parsed.value;
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith(COUNTRY_CODE) ? `+${digits}` : `+${COUNTRY_CODE}${digits.slice(-NATIONAL_LENGTH)}`;
}

/** "+998901234567" → "+998 90 123 45 67". Tanimasa — o'zgarishsiz. */
export function formatPhone(value: string): string {
  const parsed = parsePhone(value);
  if (!parsed.ok) return value;
  const n = parsed.value.slice(4);
  return `+${COUNTRY_CODE} ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}

/**
 * Bir raqamning bazadagi boshqa yozilishlari.
 *
 * 1C kalitni satr sifatida yozadi: "+998…" va "998…" ikki xil bemor
 * bo'lib qoladi. Shuning uchun asosiy kalit bo'yicha topilmasa,
 * shu variantlar ham qaraladi.
 */
export function phoneVariants(value: string): string[] {
  const parsed = parsePhone(value);
  if (!parsed.ok) return [value];
  const national = parsed.value.slice(1 + COUNTRY_CODE.length);
  return [
    parsed.value,
    `${COUNTRY_CODE}${national}`,
    national,
    `+${COUNTRY_CODE} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`,
  ];
}
