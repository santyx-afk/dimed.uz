/**
 * Jonli narxlar (F2). Sahifalar statik `analyses.json` bilan yig'iladi,
 * yuklangach `/api/prices` dan bazadagi narxlar olinib, `data-price-code`
 * kataklari yangilanadi; faolsiz qilingan tahlil qatori yashiriladi.
 * API bo'lmasa yoki jadval bo'sh bo'lsa statik narxlar qoladi.
 */
export type AnalysisPrice = {
  code: string;
  title: string;
  group: string;
  duration: string;
  price: number;
  active: boolean;
};

export const fmtSum = (n: number): string => n.toLocaleString('ru-RU').replace(/,/g, ' ');

export async function applyLivePrices(root: ParentNode = document): Promise<AnalysisPrice[] | null> {
  let list: AnalysisPrice[];
  try {
    const res = await fetch('/api/prices');
    if (!res.ok) return null;
    list = ((await res.json()) as { analyses?: AnalysisPrice[] }).analyses ?? [];
  } catch {
    return null;
  }
  if (!list.length) return null;

  const byCode = new Map(list.map((a) => [a.code, a]));

  root.querySelectorAll<HTMLElement>('[data-price-code]').forEach((cell) => {
    const live = byCode.get(cell.dataset.priceCode ?? '');
    if (!live) return;
    cell.textContent = `${fmtSum(live.price)} soʻm`;
    const row = cell.closest<HTMLElement>('[data-analysis-row]');
    if (row) row.hidden = !live.active;
  });

  // Guruh sarlavhasidagi "N ta" — ko'rinib turgan qatorlar soni; hammasi
  // yashirilgan guruh butunlay yashiriladi.
  root.querySelectorAll<HTMLElement>('[data-analysis-group]').forEach((group) => {
    const rows = [...group.querySelectorAll<HTMLElement>('[data-analysis-row]')];
    const shown = rows.filter((r) => !r.hidden).length;
    const badge = group.querySelector<HTMLElement>('[data-group-count]');
    if (badge) badge.textContent = `${shown} ta`;
    group.hidden = rows.length > 0 && shown === 0;
  });

  // Faolsiz qilingan tahlillar sonini sahifadagi "N ta tahlil" hisobidan
  // chiqaramiz. Baza qisman to'ldirilgan bo'lishi mumkin, shuning uchun
  // bazadagi faollarni sanamay, statik umumiy sondan faolsizlarni ayiramiz.
  const inactive = list.filter((a) => !a.active).length;
  root.querySelectorAll<HTMLElement>('[data-analyses-count]').forEach((el) => {
    const total = Number(el.dataset.analysesCount || el.textContent);
    if (!Number.isFinite(total)) return;
    el.dataset.analysesCount = String(total);
    el.textContent = String(Math.max(0, total - inactive));
  });

  return list;
}
