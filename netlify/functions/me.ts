import type { Context } from '@netlify/functions';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES, queryAllPages } from './lib/db.ts';
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
  patient_name?: string;
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
      patientName: a.patient_name ?? null,
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
  /* Bir telefon ostida oila a'zolari bo'lishi mumkin — natija
     kimniki ekani shu maydondan ko'rinadi. */
  PatientName?: string;
  /* 1C hujjatni bekor qilsa yoki o'chirishga belgilasa, natija
     kabinetda qolib ketmasligi kerak. */
  Posted?: boolean;
  DeletionMark?: boolean;
  AnalysisResults?: {
    Analyte?: string;
    Result?: string;
    AnalyteUnit?: string;
    AnalyteInternationalCode?: string;
  }[];
};

/**
 * Hujjat bemorga hali ham ko'rsatiladimi.
 *
 * Bayroqlar umuman bo'lmasa — ko'rsatiladi: 1C ularni yuborishni
 * keyinroq boshladi, eski yozuvlar shusiz yotibdi.
 */
const isLive = (doc: AnalysisDocument): boolean =>
  doc.DeletionMark !== true && doc.Posted !== false;

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

/*
  Bitta bemorda o'qiladigan yozuvlarning yuqori chegarasi. 1C butun
  tarixni yuklab yuborishi mumkin — cheksiz aylanib qolmaslik uchun.
*/
const MAX_RESULT_ROWS = 2000;

/**
 * Natijalarni oxirigacha o'qiydi.
 *
 * Bitta sahifa bilan cheklab bo'lmaydi: 1C hujjatlarining sort kaliti —
 * UUID, ya'ni tartibi sanaga bog'liq emas va bemor tasodifiy yozuvlarni
 * ko'rardi (eng yangilari ko'rinmasligi mumkin edi).
 *
 * Jadvallardan biri ishlamasa (ruxsat, region, hali yaratilmagan)
 * kabinet yiqilmasin: xato log-botga boradi, ikkinchi manba ko'rinadi.
 */
const queryAll = (input: ConstructorParameters<typeof QueryCommand>[0], where: string) =>
  queryAllPages(input, MAX_RESULT_ROWS).catch(async (err) => {
    await logToAdmin(where, err);
    return [];
  });

/** Kabinetda ko'rsatiladigan bitta ko'rsatkich. */
type ResultItem = {
  id: string;
  code: string;
  title: string;
  value: string | null;
  reference: string | null;
};

/**
 * Bitta laboratoriya hujjati (buyurtma) va uning ko'rsatkichlari.
 *
 * Avval har bir ko'rsatkich alohida "tahlil" bo'lib chiqardi: umumiy
 * qon tahlili 18 ta yozuvga bo'linib ketardi. Endi bemor bitta
 * yozuvni ko'radi va ichini ochib ko'rsatkichlarni ko'radi — chop
 * etilganda ham butun blank chiqadi, bitta qator emas.
 */
type ResultGroup = {
  id: string;
  date: string;
  patientName: string | null;
  biomaterial: string | null;
  sampleId: string | null;
  seen: boolean;
  items: ResultItem[];
};

async function loadResults(phone: string): Promise<ResultGroup[]> {
  const [manual, oneC] = await Promise.all([
    queryAll(
      {
        TableName: TABLES.labResults,
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
        ScanIndexForward: false,
      },
      'me/lab-natijalar',
    ),
    queryAll(
      {
        TableName: TABLES.analysisResults,
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
      },
      'me/1c-natijalar',
    ),
  ]);

  /*
    lab_results da ikki xil yozuv uchraydi: saytniki (title/date bilan)
    va 1C adashib shu jadvalga quygan hujjatlar (AnalysisResults bilan,
    title'siz). Ikkinchisini hujjat sifatida o'qiymiz — bemorning
    tarixi bekor ketmasin, noma'lum shakldagisi esa tashlab yuboriladi,
    yiqilish emas.
  */
  const manualItems = manual as (ResultRow & AnalysisDocument)[];

  /*
    Sayt API'si (lc-results) har bir ko'rsatkichni alohida yozadi va
    buyurtma raqamini saqlamaydi — shuning uchun bir sanadagilar
    bitta buyurtma deb yig'iladi.
  */
  const byDate = new Map<string, ResultGroup>();
  for (const row of manualItems) {
    if (!row.title) continue;
    const date = row.date ?? '';
    const key = `lab-${date}`;
    let group = byDate.get(key);
    if (!group) {
      group = {
        id: key,
        date,
        patientName: null,
        biomaterial: null,
        sampleId: null,
        seen: true,
        items: [],
      };
      byDate.set(key, group);
    }
    // Bittasi ham ko'rilmagan bo'lsa — butun buyurtma "yangi".
    if (!(row.seen ?? false)) group.seen = false;
    group.items.push({
      id: row.sort_key,
      code: row.code ?? '',
      title: row.title,
      value: row.value ?? null,
      reference: row.reference ?? null,
    });
  }

  const docs = [
    ...(oneC as AnalysisDocument[]),
    ...manualItems.filter((r) => !r.title && Array.isArray(r.AnalysisResults)),
  ].filter(isLive);

  // Bir hujjat ikkala jadvalda ham bo'lsa, bir marta ko'rinadi.
  const seenDocs = new Set<string>();
  const fromDocs = docs.flatMap((doc) => {
    if (seenDocs.has(doc.sort_key)) return [];
    seenDocs.add(doc.sort_key);

    const items = (doc.AnalysisResults ?? []).flatMap((a, i) => {
      /*
        Analit nomi 1C'da bo'sh bo'lishi mumkin (PrintName to'ldirilmagan) —
        qator yo'qolmasin: xalqaro kod bilan ko'rsatiladi. Nomi ham,
        qiymati ham bo'lmasa — ko'rsatadigan narsa qolmaydi.
      */
      const title = a.Analyte?.trim() || a.AnalyteInternationalCode?.trim() || '';
      const value = [a.Result, a.AnalyteUnit]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(' ');
      if (!title && !value) return [];

      return [
        {
          id: `${doc.sort_key}#${i}`,
          code: a.AnalyteInternationalCode ?? '',
          title: title || 'Koʻrsatkich',
          value: value || null,
          reference: null,
        },
      ];
    });

    if (!items.length) return [];

    return [
      {
        id: doc.sort_key,
        date: fromOneCDate(doc.Date) || fromOneCDate(doc.RegisterDate),
        patientName: doc.PatientName?.trim() || null,
        biomaterial: doc.Biomaterial?.trim() || null,
        sampleId: doc.SampleID?.trim() || null,
        // "yangi" belgisi qo'yilmaydi: 1C eski tarixni ham to'kishi mumkin.
        seen: true,
        items,
      },
    ];
  });

  return [...byDate.values(), ...fromDocs].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? ''),
  );
}
