import { TABLES, queryAllPages } from './db.ts';
import type { Appointment } from './appointments.ts';
import type { DateKey } from './time.ts';

/**
 * Bemor klinikaga keldimi — 1C "Doktorga Qabul" hujjati bo'yicha.
 *
 * Kelishuv (docs/1c-sync.md, 6.3): registrator bemorni qabul qilganda
 * 1C'da `Document.DoctorsAdmission` hujjati **o'tkaziladi** (Posted),
 * kengaytma esa uni `dimed_visits` jadvaliga yozadi. Ya'ni "o'tkazilgan
 * hujjat" = "bemor keldi". Kun oxirigacha hujjat o'tkazilmasa — kelmadi.
 *
 * Jadvalga faqat 1C yozadi, sayt faqat o'qiydi.
 */
export type VisitDocument = {
  phone: string;
  /** Hujjat UUID. */
  sort_key: string;
  /** Qabul kuni, `YYYY-MM-DD` (Toshkent) — `date-index` kaliti. */
  date?: string;
  DocumentUID?: string;
  /** Hujjat sanasi va vaqti (ISO yoki 1C `DLF=DT`). */
  Date?: string;
  /** Hujjat o'tkazilganmi. `false` — bemor hali kelmagan (qoralama). */
  Posted?: boolean;
  DeletionMark?: boolean;
  PatientName?: string;
  /** 1C bemor kodi — navbatdagi `patient_id` bilan bir xil. */
  PatientCode?: string;
  DoctorName?: string;
  DoctorCode?: string;
  Queue?: number;
  Symptoms?: string;
  /**
   * Hujjat saytdagi navbatdan yaratilgan bo'lsa: `"<doctor_day>|<time>"`.
   * Bo'lsa — eng aniq bog'lanish; bo'lmasa telefon va kun bo'yicha.
   */
  AppointmentKey?: string;
};

/** Bemor kelgan hisoblanadigan hujjat: o'tkazilgan va o'chirilmagan. */
export const isArrival = (v: VisitDocument): boolean =>
  v.Posted === true && v.DeletionMark !== true;

/**
 * Shu kundagi barcha qabullar (`date-index`).
 *
 * Jadval hali yaratilmagan yoki 1C hali yozmagan bo'lsa xato ko'tariladi —
 * chaqiruvchi uni o'zi ushlaydi va qolgan kunlarni ishlashda davom etadi.
 */
export async function visitsOnDate(dateKey: DateKey): Promise<VisitDocument[]> {
  const found = await queryAllPages({
    TableName: TABLES.visits,
    IndexName: 'date-index',
    KeyConditionExpression: '#d = :d',
    ExpressionAttributeNames: { '#d': 'date' },
    ExpressionAttributeValues: { ':d': dateKey },
  });
  return found as VisitDocument[];
}

/** Navbatning yagona kaliti — `dimed_appointments` dagi kalit juftligi. */
export const appointmentKey = (a: Pick<Appointment, 'doctor_day' | 'time'>): string =>
  `${a.doctor_day}|${a.time}`;

/** Hujjat shu navbatning bemoriga tegishlimi (telefon va kun bo'yicha). */
function samePatient(visit: VisitDocument, appointment: Appointment): boolean {
  if (visit.phone !== appointment.phone) return false;
  if (visit.date && visit.date !== appointment.date) return false;

  const code = visit.PatientCode?.trim();
  const patientId = appointment.patient_id?.trim();
  // Ikkala tomonda kod bo'lsa — mos kelishi shart: bir telefon ostidagi
  // oila a'zolari adashmasin. Birida bo'lmasa telefon va kun yetadi.
  return code && patientId ? code === patientId : true;
}

/**
 * Kunning navbatlarini kunning qabul hujjatlariga bog'laydi.
 *
 * Har hujjat **bir marta** ishlatiladi: bemor bir kunda ikki shifokorga
 * yozilgan bo'lsa, bitta o'tkazilgan hujjat ikkalasini ham "keldi"
 * qilib qo'ymaydi.
 *
 * Tartib:
 *   1. avval belgilangan navbatlar o'z hujjatini band qiladi
 *      (`visit_ref`) — cron qayta ishga tushganda bog'lanish buzilmasin;
 *   2. `AppointmentKey` — 1C hujjatni saytdagi navbatdan yaratgan;
 *   3. telefon (+ bemor kodi) va kun bo'yicha, vaqt tartibida.
 *
 * @param appointments kunning **barcha** navbatlari (belgilangani ham)
 * @returns navbat kaliti → hujjat
 */
export function matchArrivals(
  appointments: readonly Appointment[],
  visits: readonly VisitDocument[],
): Map<string, VisitDocument> {
  const free = new Map(visits.filter(isArrival).map((v) => [v.sort_key, v]));
  const matched = new Map<string, VisitDocument>();

  const take = (a: Appointment, v: VisitDocument) => {
    free.delete(v.sort_key);
    matched.set(appointmentKey(a), v);
  };

  // 1. Allaqachon bog'langanlar.
  for (const a of appointments) {
    const held = a.visit_ref ? free.get(a.visit_ref) : undefined;
    if (held) take(a, held);
  }

  // 2. 1C navbatdan yaratgan hujjatlar.
  for (const a of appointments) {
    if (matched.has(appointmentKey(a))) continue;
    const key = appointmentKey(a);
    const linked = [...free.values()].find((v) => v.AppointmentKey === key);
    if (linked) take(a, linked);
  }

  /*
    3. Telefon va kun bo'yicha — erta navbatga erta hujjat.

    Bemor kodi bor navbatlar oldin ko'riladi va kodi aynan mos kelgan
    hujjat afzal ko'riladi: bir telefon ostidagi kodsiz oila a'zosi
    boshqasining hujjatini olib qo'ymasin — bu noto'g'ri odamga
    "keldi" degani bo'lardi.
  */
  const rest = appointments
    .filter((a) => !matched.has(appointmentKey(a)))
    .sort((x, y) => {
      const byCode = Number(Boolean(y.patient_id)) - Number(Boolean(x.patient_id));
      return byCode !== 0 ? byCode : x.time.localeCompare(y.time);
    });

  for (const a of rest) {
    const patientId = a.patient_id?.trim();
    const found = [...free.values()]
      .filter((v) => samePatient(v, a))
      .sort((x, y) => {
        const exact = (v: VisitDocument) => (patientId && v.PatientCode?.trim() === patientId ? 0 : 1);
        const byExact = exact(x) - exact(y);
        return byExact !== 0 ? byExact : (x.Date ?? '').localeCompare(y.Date ?? '');
      })[0];
    if (found) take(a, found);
  }

  return matched;
}
