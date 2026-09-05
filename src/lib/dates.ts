/**
 * Sana yordamchilari — kabinet sahifalari uchun (o'zbekcha nomlar).
 *
 * Brauzer kalendari ishlatilmaydi: u qurilma tilida ochiladi, tugma va
 * chiplar esa har doim o'zbekcha. Kalit ko'rinishi: YYYY-MM-DD.
 */
export const WD = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sh'];
export const WD_FULL = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
export const OYLAR = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export const OYLAR_TOLIQ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Kalitni mahalliy sanaga aylantiradi (soat 00:00). */
export const fromKey = (key: string): Date => {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Bugungi kun (brauzer vaqti bo'yicha). */
export const todayKey = (): string => toKey(new Date());

export const addDaysKey = (key: string, offset: number): string => {
  const d = fromKey(key);
  d.setDate(d.getDate() + offset);
  return toKey(d);
};

/** 2026-08-22 → "22-avgust, shanba" */
export const fmtKey = (key: string): string => {
  const d = fromKey(key);
  return `${d.getDate()}-${OYLAR_TOLIQ[d.getMonth()]}, ${WD_FULL[d.getDay()]}`;
};

/** 2026-08-22 → "22-avgust 2026" */
export const fmtKeyYear = (key: string): string => {
  const d = fromKey(key);
  return `${d.getDate()}-${OYLAR_TOLIQ[d.getMonth()]} ${d.getFullYear()}`;
};

/** Kun chipi uchun yorliq: Kecha / Bugun / Ertaga / hafta kuni. */
export const relativeLabel = (key: string, today: string): string => {
  if (key === today) return 'Bugun';
  if (key === addDaysKey(today, 1)) return 'Ertaga';
  if (key === addDaysKey(today, -1)) return 'Kecha';
  return WD[fromKey(key).getDay()] ?? '';
};
