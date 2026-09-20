/**
 * Ko'rsatkichlarning me'yoriy (referens) oraliqlari — admin kiritadi (F4).
 *
 * Muammo: 1C ko'p analitni me'yoriy oraliqsiz yuboradi. Bunda sayt
 * qiymat me'yordami yoki undan tashqarimi — hisoblab bera olmasdi
 * (holat "—" bo'lardi). Endi klinika admin paneldan ko'rsatkich uchun
 * oraliq (masalan Gemoglobin: 120–160, erkak) kiritadi va sayt uni
 * **fallback** sifatida ishlatadi: 1C oraliq bergan bo'lsa — 1C niki
 * ustun, bermasa — admin kiritgani.
 *
 * Saqlash: yangi jadval ochmaslik uchun mavjud `prices` jadvalida
 * `item_id = "reference#<nom>#<jins>"`, `kind = "reference"`. Ommaviy
 * /api/prices va admin-prices faqat `kind==="analysis"` ni oladi,
 * shuning uchun referenslar u yerga aralashmaydi.
 */
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';

export type Gender = 'male' | 'female' | 'all';

export type ReferenceRow = {
  item_id: string;
  kind: 'reference';
  /** Ko'rsatkich nomi — kiritilganidek (masalan "Gemoglobin"). */
  name: string;
  low: number | null;
  high: number | null;
  unit?: string;
  /** 'male' / 'female' — jinsga xos; 'all' — hammaga. */
  gender: Gender;
  updated_at?: string;
};

/** Taqqoslash uchun normallashtirish (analysis-dict/panels bilan bir xil). */
const norm = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[ʻʼ’‘`´']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

export const isGender = (value: unknown): value is Gender =>
  value === 'male' || value === 'female' || value === 'all';

/** Yozuv kaliti: nom + jins bo'yicha yagona. */
export const referenceId = (name: string, gender: Gender): string =>
  `reference#${norm(name)}#${gender}`;

/** `prices` jadvalidan barcha referens qatorlarini o'qiydi. */
export async function loadReferenceRows(): Promise<ReferenceRow[]> {
  const { Items = [] } = await db.send(new ScanCommand({ TableName: TABLES.prices }));
  return (Items as ReferenceRow[]).filter((r) => r.kind === 'reference');
}

export type ReferenceHit = { low: number | null; high: number | null; unit?: string };

/**
 * Referens qatorlaridan tez qidiruv funksiyasi.
 *
 * Nom + jins bo'yicha eng mos oraliqni beradi: avval jinsga xos
 * ("male"/"female"), topilmasa umumiy ("all"). Hech biri bo'lmasa null.
 */
export function buildReferenceLookup(
  rows: readonly ReferenceRow[],
): (name: string, gender: 'male' | 'female' | null) => ReferenceHit | null {
  const map = new Map<string, ReferenceRow>();
  for (const r of rows) map.set(`${norm(r.name)}#${r.gender}`, r);

  return (name, gender) => {
    const n = norm(name);
    if (!n) return null;
    const hit = (gender && map.get(`${n}#${gender}`)) || map.get(`${n}#all`);
    if (!hit) return null;
    return { low: hit.low ?? null, high: hit.high ?? null, unit: hit.unit };
  };
}
