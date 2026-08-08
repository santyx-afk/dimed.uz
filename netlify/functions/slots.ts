import type { Context } from '@netlify/functions';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { getDoctor } from './lib/auth.ts';
import { availability, type Shift } from './lib/slots.ts';
import { dayAppointments, takenTimes } from './lib/appointments.ts';
import { isDateKey, weekdayOf, type DateKey } from './lib/time.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/** GET /api/slots?doctor=ashurov&date=2026-08-12 */
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return error('Faqat GET', 405);

  const url = new URL(request.url);
  const doctorId = url.searchParams.get('doctor');
  const date = url.searchParams.get('date');

  if (!doctorId) return error('doctor parametri kerak');
  if (!date || !isDateKey(date)) return error('date parametri YYYY-MM-DD ko‘rinishida bo‘lishi kerak');

  try {
    const doctor = await getDoctor(doctorId);
    if (!doctor || doctor.active === false) return error('Shifokor topilmadi', 404);

    if (!doctor.workdays.includes(weekdayOf(date))) {
      return json({ doctor: doctorId, date, slots: [], reason: 'dam olish kuni' });
    }

    const shifts = await shiftsFor(doctor.doctor_id, date, doctor.shifts);
    if (shifts.length === 0) {
      return json({ doctor: doctorId, date, slots: [], reason: 'shifokor bu kuni qabul qilmaydi' });
    }

    const now = new Date();
    const slots = availability({
      shifts,
      slotMinutes: doctor.slot_minutes,
      dateKey: date,
      taken: takenTimes(await dayAppointments(doctorId, date), now),
      now,
    });

    return json(
      { doctor: doctorId, date, slotMinutes: doctor.slot_minutes, price: doctor.price, slots },
      200,
      /*
        Keshlanmaydi: bron qilingandan keyin bemor orqaga qaytsa,
        o'zi band qilgan slotni yana bo'sh ko'rib, 409 xatosiga
        duch kelardi.
      */
      { 'cache-control': 'no-store' },
    );
  } catch (err) {
    await logToAdmin('slots', err);
    return error('Slotlarni olishda xatolik', 500);
  }
};

/**
 * Kunning smenalari: shifokor shu kun uchun alohida jadval kiritgan
 * bo'lsa o'sha, aks holda doimiy jadvali.
 */
async function shiftsFor(
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
