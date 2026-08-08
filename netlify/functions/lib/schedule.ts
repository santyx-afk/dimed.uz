import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';
import { toMinutes, type Shift } from './slots.ts';
import { isTime, type DateKey } from './time.ts';

export const ALLOWED_SLOT_MINUTES = [10, 15, 20, 30];
const MAX_SHIFTS_PER_DAY = 4;

export type ShiftsCheck = { ok: true; shifts: Shift[] } | { ok: false; message: string };

/**
 * Shifokor kiritgan smenalarni tekshiradi va vaqt bo'yicha tartiblaydi.
 * Smenalar orasidagi bo'shliq tanaffus hisoblanadi, shuning uchun
 * ular bir-birining ustiga tushmasligi shart.
 */
export function checkShifts(shifts: unknown): ShiftsCheck {
  if (!Array.isArray(shifts) || shifts.length === 0) {
    return { ok: false, message: 'Kamida bitta smena kerak' };
  }
  if (shifts.length > MAX_SHIFTS_PER_DAY) {
    return { ok: false, message: `Bir kunda ${MAX_SHIFTS_PER_DAY} tadan ko'p smena bo'lmaydi` };
  }

  for (const shift of shifts as Shift[]) {
    if (!shift || !isTime(shift.start) || !isTime(shift.end)) {
      return { ok: false, message: "Smena vaqti HH:MM ko'rinishida bo'lishi kerak" };
    }
    if (toMinutes(shift.end) <= toMinutes(shift.start)) {
      return { ok: false, message: "Smena tugashi boshlanishidan keyin bo'lishi kerak" };
    }
  }

  const sorted = [...(shifts as Shift[])].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (prev && current && toMinutes(current.start) < toMinutes(prev.end)) {
      return { ok: false, message: "Smenalar bir-birining ustiga tushmasligi kerak" };
    }
  }

  return { ok: true, shifts: sorted };
}

/**
 * Kunning smenalari: shifokor shu kun uchun alohida jadval kiritgan
 * bo'lsa o'sha, aks holda doimiy jadvali. Dam olish kunida — bo'sh.
 */
export async function shiftsFor(
  doctorId: string,
  date: DateKey,
  fallback: Shift[],
): Promise<Shift[]> {
  const override = await db.send(
    new GetCommand({ TableName: TABLES.schedules, Key: { doctor_id: doctorId, date } }),
  );
  const item = override.Item as { shifts?: Shift[]; day_off?: boolean } | undefined;

  if (item?.day_off) return [];
  return item?.shifts ?? fallback;
}

export const isAllowedSlotMinutes = (value: unknown): boolean =>
  typeof value === 'number' && ALLOWED_SLOT_MINUTES.includes(value);

/** Shifokor ro'yxatida bemor raqami to'liq ko'rsatilmaydi. */
export const maskPhone = (phone: string): string =>
  phone.length > 9 ? `${phone.slice(0, 7)}•••${phone.slice(-2)}` : phone;
