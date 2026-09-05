import { TABLES, queryAllPages } from './db.ts';
import { doctorDayKey } from './slots.ts';
import type { DateKey } from './time.ts';

export type AppointmentStatus =
  /** onlayn to'lov kutilmoqda — 5 daqiqadan keyin slot bo'shaydi */
  | 'hold'
  /** to'langan */
  | 'paid'
  /** klinikada to'lash — bron darhol kuchga kiradi */
  | 'booked'
  /** qabul bo'lib o'tdi */
  | 'done'
  /** bemor boshqa vaqtga ko'chirdi */
  | 'moved'
  | 'cancelled'
  /** shifokor ishga chiqa olmadi — klinika bekor qildi */
  | 'cancelled_by_clinic';

/** Slotni bo'shatadigan holatlar: bunday yozuv bandlikka ta'sir qilmaydi. */
const FREEING: ReadonlySet<string> = new Set(['moved', 'cancelled', 'cancelled_by_clinic']);

/** Kuchda turgan bron — eslatma, ko'chirish va bekor qilish shularga tegishli. */
const CONFIRMED: ReadonlySet<string> = new Set(['paid', 'booked']);

export type Appointment = {
  doctor_day: string;
  time: string;
  doctor_id: string;
  date: DateKey;
  phone: string;
  telegram_id?: string;
  starts_at: string;
  status: AppointmentStatus;
  price: number;
  /** hold uchun: shu vaqtdan keyin slot yana bo'shaydi (unix sekund) */
  hold_until?: number;
  payment_id?: string;
  /** navbat kim uchun olingani (bir telefon — bir oila) */
  patient_id?: string;
  patient_name?: string;
  /** YYYY-MM-DD — bron paytidagi bemor yozuvidan (B1) */
  patient_birth_date?: string;
  /** eslatma yuborilgan lahza — takror yuborilmasligi uchun */
  reminded_at?: string;
  created_at: string;
};

/** Shu kundagi barcha yozuvlar (hold va to'langanlar). */
export async function dayAppointments(
  doctorId: string,
  dateKey: DateKey,
): Promise<Appointment[]> {
  const found = await queryAllPages({
    TableName: TABLES.appointments,
    KeyConditionExpression: 'doctor_day = :k',
    ExpressionAttributeValues: { ':k': doctorDayKey(doctorId, dateKey) },
  });
  return found as Appointment[];
}

/**
 * Yozuv slotni band qilib turibdimi. Muddati o'tgan hold band emas —
 * DynamoDB TTL kechikishi mumkin, shuning uchun o'zimiz tekshiramiz.
 */
export function holdsSlot(
  appointment: { status: string; hold_until?: number },
  now: Date,
): boolean {
  if (FREEING.has(appointment.status)) return false;
  if (appointment.status === 'hold') {
    return (appointment.hold_until ?? 0) > Math.floor(now.getTime() / 1000);
  }
  return true;
}

/** Band hisoblanadigan vaqtlar. */
export function takenTimes(appointments: Appointment[], now: Date): string[] {
  return appointments.filter((a) => holdsSlot(a, now)).map((a) => a.time);
}

/** Bron kuchdami: to'langan yoki klinikada to'lanadigan. */
export const isConfirmed = (appointment: { status: string }): boolean =>
  CONFIRMED.has(appointment.status);

/**
 * Butun klinika bo'yicha shu kundagi yozuvlar (date-index).
 * Eslatmalar va kunlik xulosa uchun — ular shifokorni oldindan bilmaydi.
 */
export async function appointmentsOnDate(dateKey: DateKey): Promise<Appointment[]> {
  const found = await queryAllPages({
    TableName: TABLES.appointments,
    IndexName: 'date-index',
    KeyConditionExpression: '#d = :d',
    ExpressionAttributeNames: { '#d': 'date' },
    ExpressionAttributeValues: { ':d': dateKey },
  });
  return found as Appointment[];
}
