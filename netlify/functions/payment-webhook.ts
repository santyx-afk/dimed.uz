import type { Context } from '@netlify/functions';
import { timingSafeEqual } from 'node:crypto';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { required } from './lib/env.ts';
import { doctorDayKey } from './lib/slots.ts';
import { getDoctor } from './lib/auth.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * To'lov tizimidan tasdiq. RHMT ulangach shu endpoint ishlatiladi:
 * to'lov muvaffaqiyatli bo'lsa hold -> paid, aks holda hold bo'shatiladi.
 */

type Body = { payment_id?: string; status?: 'success' | 'failed'; reference?: string };

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return error('Faqat POST', 405);

  const given = Buffer.from(request.headers.get('x-payment-signature') ?? '');
  const expected = Buffer.from(required('PAYMENT_WEBHOOK_SECRET'));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return error('Imzo noto‘g‘ri', 401);
  }

  try {
    const body = (await request.json()) as Body;
    if (!body.payment_id || !body.status) return error('payment_id va status kerak');

    const found = await db.send(
      new GetCommand({ TableName: TABLES.payments, Key: { payment_id: body.payment_id } }),
    );
    const payment = found.Item as
      | {
          phone: string;
          doctor_id: string;
          date: string;
          time: string;
          amount: number;
          status: string;
        }
      | undefined;

    if (!payment) return error('To‘lov topilmadi', 404);
    // Webhook takror kelishi mumkin — ikkinchi marta hech narsa o'zgarmaydi.
    if (payment.status === 'paid' || payment.status === 'failed') {
      return json({ ok: true, alreadyProcessed: true });
    }

    const paid = body.status === 'success';

    await db.send(
      new UpdateCommand({
        TableName: TABLES.payments,
        Key: { payment_id: body.payment_id },
        UpdateExpression: 'SET #s = :s, reference = :r, updated_at = :u',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': paid ? 'paid' : 'failed',
          ':r': body.reference ?? null,
          ':u': new Date().toISOString(),
        },
      }),
    );

    const key = {
      doctor_day: doctorDayKey(payment.doctor_id, payment.date),
      time: payment.time,
    };

    if (paid) {
      await db.send(
        new UpdateCommand({
          TableName: TABLES.appointments,
          Key: key,
          UpdateExpression: 'SET #s = :paid REMOVE hold_until',
          // Faqat shu to'lovga tegishli hold tasdiqlanadi.
          ConditionExpression: 'payment_id = :pid',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':paid': 'paid', ':pid': body.payment_id },
        }),
      );
      await notify(payment);
    } else {
      // To'lov o'tmadi — slot darhol bo'shaydi.
      await db.send(
        new UpdateCommand({
          TableName: TABLES.appointments,
          Key: key,
          UpdateExpression: 'SET #s = :cancelled, hold_until = :zero',
          ConditionExpression: 'payment_id = :pid',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':cancelled': 'cancelled', ':zero': 0, ':pid': body.payment_id },
        }),
      );
    }

    return json({ ok: true });
  } catch (err) {
    await logToAdmin('payment-webhook', err);
    return error('To‘lovni qayd etishda xatolik', 500);
  }
};

async function notify(payment: {
  phone: string;
  doctor_id: string;
  date: string;
  time: string;
  amount: number;
}): Promise<void> {
  try {
    const [doctor, appointment] = await Promise.all([
      getDoctor(payment.doctor_id),
      db.send(
        new GetCommand({
          TableName: TABLES.appointments,
          Key: { doctor_day: doctorDayKey(payment.doctor_id, payment.date), time: payment.time },
        }),
      ),
    ]);

    const telegramId = (appointment.Item as { telegram_id?: string } | undefined)?.telegram_id;
    if (!telegramId) return;

    await sendMessage(
      telegramId,
      `✅ <b>Broningiz tasdiqlandi!</b>\n\n` +
        `Shifokor: ${doctor?.name ?? payment.doctor_id}\n` +
        `Sana: ${payment.date}, soat ${payment.time}\n` +
        `To'lov: ${payment.amount.toLocaleString('ru-RU')} so'm qabul qilindi\n\n` +
        `Qabulga 1 soat qolganda eslatma yuboramiz.`,
    );
  } catch (err) {
    await logToAdmin('payment-webhook/xabar', err);
  }
}
