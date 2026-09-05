import type { Context } from '@netlify/functions';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { sessionFrom, doctorFor } from './lib/auth.ts';
import { doctorDayKey } from './lib/slots.ts';
import { isDateKey, isTime } from './lib/time.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * POST /api/appointment-status — shifokor navbatni belgilaydi (E2):
 *   { date, time, status: 'done' | 'no_show' }
 *
 * Faqat o'z navbati; faqat kuchdagi (paid/booked) yoki avval
 * belgilangan (done/no_show — tuzatish uchun) yozuv. Belgilangan lahza
 * `marked_at` da qoladi; baho so'rovi (G2) `done` ga tayanadi,
 * `no_show` bo'lsa baho so'ralmaydi.
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
    try {
      await db.send(
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
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        return error('Bunday navbat yo‘q yoki uni belgilab bo‘lmaydi', 404);
      }
      throw err;
    }

    return json({ ok: true, date, time, status });
  } catch (err) {
    await logToAdmin('appointment-status', err);
    return error('Navbatni belgilashda xatolik', 500);
  }
};
