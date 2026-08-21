import type { Context } from '@netlify/functions';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { sessionFrom, getDoctor } from './lib/auth.ts';
import { isConfirmed } from './lib/appointments.ts';
import { isBookable } from './lib/slots.ts';
import { logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/** GET /api/me — bemorning qabullari va tahlil natijalari. */
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return error('Faqat GET', 405);

  const session = sessionFrom(request);
  if (!session) return error('Avval Telegram orqali kiring', 401);

  try {
    const [appointments, results] = await Promise.all([
      loadAppointments(session.phone),
      loadResults(session.phone),
    ]);

    return json({ phone: session.phone, appointments, results }, 200, {
      'cache-control': 'private, no-store',
    });
  } catch (err) {
    await logToAdmin('me', err);
    return error('Ma‘lumotlarni olishda xatolik', 500);
  }
};

type AppointmentRow = {
  doctor_id: string;
  date: string;
  time: string;
  starts_at: string;
  status: string;
  price: number;
};

async function loadAppointments(phone: string) {
  const found = await db.send(
    new QueryCommand({
      TableName: TABLES.appointments,
      IndexName: 'patient-index',
      KeyConditionExpression: 'phone = :p',
      ExpressionAttributeValues: { ':p': phone },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );

  const rows = ((found.Items ?? []) as AppointmentRow[]).filter(
    /*
      Tugallanmagan hold va ko'chirilgan yozuvlar ko'rsatilmaydi
      (ko'chirilganining o'rniga yangisi turadi), klinika bekor
      qilgani esa ko'rinadi — bemor buni bilishi kerak.
    */
    (a) =>
      a.status === 'paid' ||
      a.status === 'booked' ||
      a.status === 'done' ||
      a.status === 'cancelled_by_clinic',
  );

  // Shifokor nomlarini bir marta yuklaymiz.
  const names = new Map<string, string>();
  await Promise.all(
    [...new Set(rows.map((r) => r.doctor_id))].map(async (id) => {
      const doctor = await getDoctor(id);
      names.set(id, doctor?.name ?? id);
      if (doctor) names.set(`${id}:job`, doctor.job);
    }),
  );

  const now = new Date();
  const nowIso = now.toISOString();
  return rows
    .map((a) => ({
      doctorId: a.doctor_id,
      doctorName: names.get(a.doctor_id) ?? a.doctor_id,
      doctorJob: names.get(`${a.doctor_id}:job`) ?? '',
      date: a.date,
      time: a.time,
      startsAt: a.starts_at,
      status: a.status,
      price: a.price,
      upcoming: a.starts_at >= nowIso,
      // Ko'chirish faqat kuchdagi bronga va 1 soat qolgunicha.
      canMove: isConfirmed(a) && isBookable(a.date, a.time, now),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

type ResultRow = {
  sort_key: string;
  code: string;
  title: string;
  value?: string;
  reference?: string;
  type: 'pdf' | 'text';
  date: string;
  seen?: boolean;
};

/** 1C to'g'ridan-to'g'ri yozadigan hujjat (dimed_analysis_results). */
type AnalysisDocument = {
  sort_key: string;
  Date?: string;
  RegisterDate?: string;
  SampleID?: string;
  Biomaterial?: string;
  AnalysisResults?: {
    Analyte?: string;
    Result?: string;
    AnalyteUnit?: string;
    AnalyteInternationalCode?: string;
  }[];
};

/**
 * 1C sanasi "21.08.2026 14:30:00" → "2026-08-21T14:30:00".
 * Soat bir xonali ham keladi ("9:30:24"). ISO — o'zgarishsiz.
 */
const fromOneCDate = (raw: string | undefined): string => {
  if (!raw) return '';
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return raw;
  const time = `${(m[4] ?? '00').padStart(2, '0')}:${m[5] ?? '00'}:${m[6] ?? '00'}`;
  return `${m[3]}-${m[2]}-${m[1]}T${time}`;
};

async function loadResults(phone: string) {
  const [manual, oneC] = await Promise.all([
    db.send(
      new QueryCommand({
        TableName: TABLES.labResults,
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
        ScanIndexForward: false,
        Limit: 100,
      }),
    ),
    db.send(
      new QueryCommand({
        TableName: TABLES.analysisResults,
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
        Limit: 50,
      }),
    ),
  ]);

  const rows = ((manual.Items ?? []) as ResultRow[]).map((r) => ({
    id: r.sort_key,
    code: r.code,
    title: r.title,
    value: r.value ?? null,
    reference: r.reference ?? null,
    type: r.type,
    date: r.date,
    seen: r.seen ?? false,
  }));

  /*
    1C hujjatida bitta buyurtmaning hamma analitlari yotadi — kabinet
    esa tekis ro'yxat ko'rsatadi, shuning uchun yoyamiz. "yangi"
    belgisi qo'yilmaydi: 1C eski tarixni ham to'kib yuborishi mumkin.
  */
  const fromDocs = ((oneC.Items ?? []) as AnalysisDocument[]).flatMap((doc) => {
    const date = fromOneCDate(doc.Date) || fromOneCDate(doc.RegisterDate);
    return (doc.AnalysisResults ?? [])
      .filter((a) => a.Analyte)
      .map((a, i) => ({
        id: `${doc.sort_key}#${i}`,
        code: a.AnalyteInternationalCode ?? '',
        title: a.Analyte ?? '',
        value: [a.Result, a.AnalyteUnit].filter(Boolean).join(' ') || null,
        reference: null,
        type: 'text' as const,
        date,
        seen: true,
      }));
  });

  return [...rows, ...fromDocs].sort((a, b) => b.date.localeCompare(a.date));
}
