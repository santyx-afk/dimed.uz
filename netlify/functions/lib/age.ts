/**
 * Shifokorning yosh cheklovi — server tomoni.
 *
 * Qoida va matnlar sayt bilan bitta joyda (`src/lib/age.ts`):
 * bron vidjeti bemorni oldindan filtrlaydi, server esa oxirgi
 * so'zni aytadi — vidjetni chetlab o'tib yuborilgan so'rov ham
 * shu yerda to'xtaydi.
 */
export type { AgeGroup } from '../../../src/lib/age.ts';
export { AGE_LIMIT, AGE_GROUPS, isAgeGroup, toAgeGroup, fitsAgeGroup, ageRejected } from '../../../src/lib/age.ts';

/**
 * Tug'ilgan sanadan yosh (YYYY-MM-DD). `at` — qabul kuni: bugun 15
 * yoshda bo'lgan bemor kelasi oyda 16 yoshga to'lsa, o'sha kunga
 * kattalar shifokoriga yozila oladi.
 */
export function ageOn(birthDate: string, at: Date = new Date()): number | null {
  const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  let age = at.getUTCFullYear() - Number(m[1]);
  const month = at.getUTCMonth() + 1;
  const day = at.getUTCDate();
  if (month < Number(m[2]) || (month === Number(m[2]) && day < Number(m[3]))) age--;
  return age >= 0 ? age : null;
}
