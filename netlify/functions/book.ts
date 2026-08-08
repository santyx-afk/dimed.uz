import type { Context } from '@netlify/functions';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { sessionFrom, getDoctor } from './lib/auth.ts';
import { doctorDayKey, isValidSlot, isBookable } from './lib/slots.ts';
import { shiftsFor } from './lib/schedule.ts';
import { isDateKey, isTime, toInstant, weekdayOf, type DateKey } from './lib/time.ts';
import { createPayment } from './lib/payment.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/** Hold shuncha vaqt turadi — to'lov shu oraliqda tugallanishi kerak. */
const HOLD_SECONDS = 5 * 60;

type Body = { doctor?: string; date?: string; time?: string };

/** POST /api/book — slotni band qiladi va to'lovni boshlaydi. */
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return error('Faqat POST', 405);

  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);

  try {
    const body = (await request.json()) as Body;
    const { doctor: doctorId, date, time } = body;

    if (!doctorId || !date || !time) return error('doctor, date va time kerak');
    if (!isDateKey(date) || !isTime(time)) return error('Sana yoki vaqt formati noto‘g‘ri');

    const doctor = await getDoctor(doctorId);
    if (!doctor || doctor.active === false) return error('Shifokor topilmadi', 404);
    if (!doctor.workdays.includes(weekdayOf(date))) return error('Bu kuni shifokor qabul qilmaydi');

    const shifts = await shiftsFor(doctorId, date, doctor.shifts);
    if (!isValidSlot(shifts, doctor.slot_minutes, time)) {
      return error('Bunday slot mavjud emas');
    }

    const now = new Date();
    if (!isBookable(date, time, now)) {
      return error('Qabulga 1 soatdan kam qoldi — boshqa vaqtni tanlang');
    }

    const payment = await createPayment({
      amount: doctor.price,
      appointmentKey: `${doctorDayKey(doctorId, date)}#${time}`,
      phone: session.phone,
    });

    /*
      Onlayn to'lovda slot avval 5 daqiqaga ushlab turiladi (hold) va
      to'lov tasdig'idan keyin "paid" bo'ladi. Klinikada to'lash
      rejimida esa bron shu zahoti kuchga kiradi — aks holda bemorga
      "band qilindi" deb aytib, 5 daqiqadan keyin slotni bo'shatib
      yuborgan bo'lardik.
    */
    const holdUntil =
      payment.mode === 'online' ? Math.floor(now.getTime() / 1000) + HOLD_SECONDS : undefined;
    const status = payment.mode === 'online' ? 'hold' : 'booked';

    /*
      Slotni atomik band qilamiz: yozuv yo'q bo'lsa yoki eski hold
      muddati o'tgan bo'lsagina yoziladi. Ikki bemor bir vaqtda
      bosса — bittasi ConditionalCheckFailed oladi.
    */
    try {
      await db.send(
        new PutCommand({
          TableName: TABLES.appointments,
          Item: {
            doctor_day: doctorDayKey(doctorId, date),
            time,
            doctor_id: doctorId,
            date,
            phone: session.phone,
            telegram_id: session.userId,
            starts_at: toInstant(date, time).toISOString(),
            status,
            hold_until: holdUntil,
            price: doctor.price,
            payment_id: payment.paymentId,
            created_at: now.toISOString(),
          },
          ConditionExpression:
            'attribute_not_exists(doctor_day) OR (#s = :hold AND hold_until < :now)',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':hold': 'hold',
            ':now': Math.floor(now.getTime() / 1000),
          },
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        return error('Bu vaqt hozirgina band qilindi — boshqa slotni tanlang', 409);
      }
      throw err;
    }

    await db.send(
      new PutCommand({
        TableName: TABLES.payments,
        Item: {
          payment_id: payment.paymentId,
          phone: session.phone,
          doctor_id: doctorId,
          date,
          time,
          amount: doctor.price,
          mode: payment.mode,
          status: payment.mode === 'at_clinic' ? 'pending_at_clinic' : 'pending',
          created_at: now.toISOString(),
        },
      }),
    );

    if (payment.mode === 'at_clinic') {
      await confirmAtClinic(session.userId, doctor.name, date, time, doctor.price);
    }

    return json({
      ok: true,
      mode: payment.mode,
      paymentId: payment.paymentId,
      redirectUrl: payment.redirectUrl,
      holdUntil,
      appointment: { doctor: doctorId, doctorName: doctor.name, date, time, price: doctor.price },
    });
  } catch (err) {
    await logToAdmin('book', err);
    return error('Bron qilishda xatolik. Birozdan so‘ng urinib ko‘ring.', 500);
  }
};

/** Bot orqali tasdiq. Xabar ketmasa ham bron kuchda qoladi. */
async function confirmAtClinic(
  telegramId: string,
  doctorName: string,
  date: DateKey,
  time: string,
  price: number,
): Promise<void> {
  try {
    await sendMessage(
      telegramId,
      `✅ <b>Navbatingiz band qilindi</b>\n\n` +
        `Shifokor: ${doctorName}\n` +
        `Sana: ${date}, soat ${time}\n` +
        `Narx: ${price.toLocaleString('ru-RU')} so'm\n\n` +
        `To'lov qabulxonada amalga oshiriladi. Iltimos, 10 daqiqa oldin keling.\n` +
        `Vaqtni ko'chirish — shaxsiy kabinetda, qabulgacha 1 soat qolgunicha.`,
    );
  } catch (err) {
    await logToAdmin('book/confirm-xabar', err);
  }
}
