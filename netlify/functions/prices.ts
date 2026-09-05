import type { Context } from '@netlify/functions';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import type { DoctorRecord } from './lib/auth.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * GET /api/prices — saytdagi barcha narxlar (F2), ommaviy.
 *
 * Tahlil turlari `prices` jadvalidan (admin tahrirlaydi), shifokor
 * qabuli narxi `doctors` jadvalidan. Sahifalar statik narx bilan
 * chiziladi va shu javob bilan yangilanadi — jadval bo'sh bo'lsa
 * statik qiymatlar qoladi.
 */
export type PriceRow = {
  item_id: string;
  kind: 'analysis';
  code: string;
  title: string;
  group?: string;
  duration?: string;
  price: number;
  active?: boolean;
  updated_at?: string;
};

export const toAnalysisPrice = (r: PriceRow) => ({
  code: r.code,
  title: r.title,
  group: r.group ?? '',
  duration: r.duration ?? '',
  price: r.price,
  active: r.active !== false,
});

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return error('Faqat GET', 405);

  try {
    const [priceRows, doctorRows] = await Promise.all([
      db
        .send(new ScanCommand({ TableName: TABLES.prices }))
        .then((r) => (r.Items ?? []) as PriceRow[])
        // Jadval hali yaratilmagan bo'lsa sayt yiqilmasin — statik narxlar qoladi.
        .catch(async (err) => {
          await logToAdmin('prices/jadval', err);
          return [] as PriceRow[];
        }),
      db.send(new ScanCommand({ TableName: TABLES.doctors })).then((r) => (r.Items ?? []) as DoctorRecord[]),
    ]);

    const analyses = priceRows
      .filter((r) => r.kind === 'analysis' && r.code)
      .map(toAnalysisPrice)
      .sort((a, b) => a.group.localeCompare(b.group, 'uz') || a.title.localeCompare(b.title, 'uz'));

    const doctors = doctorRows
      .filter((d) => d.active !== false)
      .map((d) => ({ id: d.doctor_id, name: d.name, price: d.price }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return json({ analyses, doctors }, 200, { 'cache-control': 'public, max-age=300' });
  } catch (err) {
    await logToAdmin('prices', err);
    return error('Narxlarni olishda xatolik', 500);
  }
};
