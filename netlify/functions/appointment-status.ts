import type { Context } from '@netlify/functions';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { sessionFrom, doctorFor } from './lib/auth.ts';
import { doctorDayKey } from './lib/slots.ts';
import { isDateKey, isTime } from './lib/time.ts';
import type { Appointment } from './lib/appointments.ts';
import { askRating } from './lib/ratings.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * POST /api/appointment-status — shifokor navbatni belgilaydi (E2):
 *   { date, time, status: 'done' | 'no_show' }
 *
 * Faqat o'z navbati; faqat kuchdagi (paid/booked) yoki avval
 * belgilangan (done/no_show — tuzatish uchun) yozuv. Belgilangan lahza
 * `marked_at` da qoladi. `done` bo'lsa bemordan darhol baho so'raladi
 * (G2, bir marta); `no_show` bo'lsa so'ralmaydi.
 */
type Body = { date?: string; time?: string; status?: string };

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return error('Faqat POST', 405);

  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);

  try {
    const doctor = await doctorFor(session);
    if (!doctor) return error('Bu bo‘lim faqat shifokorlar uchun', 403);

    const body = (await request.json().catch(() => ({}))) as Body;
    const { date, time, status } = body;
    if (!date || !isDateKey(date) || !time || !isTime(time)) {
      return error('date (YYYY-MM-DD) va time (HH:MM) kerak');
    }
    if (status !== 'done' && status !== 'no_show') {
      return error('status done yoki no_show bo‘lishi kerak');
    }

    const now = new Date().toISOString();
    let updated: Appointment | undefined;
    try {
      const res = await db.send(
        new UpdateCommand({
          TableName: TABLES.appointments,
          Key: { doctor_day: doctorDayKey(doctor.doctor_id, date), time },
          UpdateExpression: 'SET #s = :s, marked_at = :now, updated_at = :now',
          // Yozuv yo'q bo'lsa holat ham yo'q — shart o'z-o'zidan buziladi.
          ConditionExpression: '#s = :paid OR #s = :booked OR #s = :done OR #s = :noShow',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':s': status,
            ':now': now,
            ':paid': 'paid',
            ':booked': 'booked',
            ':done': 'done',
            ':noShow': 'no_show',
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      updated = res.Attributes as Appointment | undefined;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        return error('Bunday navbat yo‘q yoki uni belgilab bo‘lmaydi', 404);
      }
      throw err;
    }

    // Baho so'rovi ketmasa ham belgilash muvaffaqiyatli — xato faqat logga.
    let ratingAsked = false;
    if (status === 'done' && updated) {
      ratingAsked = await askRating(updated, doctor).catch(async (err) => {
        await logToAdmin('appointment-status/baho', err);
        return false;
      });
    }

    return json({ ok: true, date, time, status, ratingAsked });
  } catch (err) {
    await logToAdmin('appointment-status', err);
    return error('Navbatni belgilashda xatolik', 500);
  }
};
