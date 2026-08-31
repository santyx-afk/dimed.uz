import type { Context } from '@netlify/functions';
import { sessionFrom } from './lib/auth.ts';
import { listPatients, addLocalPatient, selectPatient } from './lib/patients.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * /api/patients — telefonga bog'langan bemorlar.
 *
 * Bir raqamdan butun oila foydalanadi: ota-ona bolasini o'z telefoni
 * bilan yozdiradi. Shuning uchun kirishda ham, navbat olishda ham
 * "kim uchun" degan savol bo'ladi.
 *
 * GET  — ro'yxat va tanlab qo'yilgani
 * POST — { action: "select", id } yoki
 *        { action: "add", firstName, lastName, patronymic? }
 */
export default async (request: Request, _context: Context): Promise<Response> => {
  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);

  try {
    if (request.method === 'GET') {
      const data = await listPatients(session.phone, session.userId);
      return json(data, 200, { 'cache-control': 'private, no-store' });
    }

    if (request.method !== 'POST') return error('Faqat GET yoki POST', 405);

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      id?: string;
      firstName?: unknown;
      lastName?: unknown;
      patronymic?: unknown;
    };

    if (body.action === 'select') {
      if (!body.id) return error('id kerak');
      const { patients } = await listPatients(session.phone, session.userId);
      if (!patients.some((p) => p.id === body.id)) return error('Bunday bemor topilmadi', 404);

      await selectPatient(session.userId, body.id);
      return json({ ok: true, activeId: body.id });
    }

    if (body.action === 'add') {
      const added = await addLocalPatient(session.userId, {
        firstName: body.firstName,
        lastName: body.lastName,
        patronymic: body.patronymic,
      });
      if ('error' in added) return error(added.error);
      return json({ ok: true, patient: added, activeId: added.id });
    }

    return error('action noto‘g‘ri');
  } catch (err) {
    await logToAdmin('patients', err);
    return error('Amalni bajarib bo‘lmadi', 500);
  }
};
