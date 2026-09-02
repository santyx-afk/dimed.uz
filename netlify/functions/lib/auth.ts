import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';
import { optional } from './env.ts';
import { readSession, type Session } from './session.ts';
import type { Shift } from './slots.ts';

export type DoctorRecord = {
  doctor_id: string;
  name: string;
  job: string;
  dept_id: string;
  telegram_id?: string;
  slot_minutes: number;
  shifts: Shift[];
  workdays: number[];
  price: number;
  active?: boolean;
  experience?: string;
  photo?: string;
  hours?: string;
  phone?: string;
};

/** Saytga (bron vidjeti, jamoa) ko'rsatiladigan shifokor shakli. */
export type PublicDoctor = {
  id: string;
  name: string;
  job: string;
  deptId: string;
  experience: string;
  photo: string;
  hours: string;
  shifts: Shift[];
  slotMinutes: number;
  workdays: number[];
  price: number;
};

/** Bazadagi yozuvni saytdagi shaklga o'giradi (telegram_id chiqmaydi). */
export const toPublicDoctor = (d: DoctorRecord): PublicDoctor => ({
  id: d.doctor_id,
  name: d.name,
  job: d.job,
  deptId: d.dept_id,
  experience: d.experience ?? '',
  photo: d.photo ?? '',
  hours: d.hours ?? '',
  shifts: d.shifts,
  slotMinutes: d.slot_minutes,
  workdays: d.workdays,
  price: d.price,
});

/**
 * Sessiya egasi admin (klinika egasi)mi? `ADMIN_TELEGRAM_IDS`
 * (vergul bilan ajratilgan telegram_id ro'yxati) bo'yicha aniqlanadi.
 * Ro'yxat bo'sh bo'lsa hech kim admin emas — panel yopiq turadi.
 */
export function isAdmin(session: Session | null): boolean {
  if (!session) return false;
  const ids = optional('ADMIN_TELEGRAM_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(session.userId));
}

/** Cookie'dagi sessiya. Yo'q bo'lsa null. */
export const sessionFrom = (request: Request): Session | null =>
  readSession(request.headers.get('cookie') ?? undefined);

export async function getDoctor(doctorId: string): Promise<DoctorRecord | null> {
  const found = await db.send(
    new GetCommand({ TableName: TABLES.doctors, Key: { doctor_id: doctorId } }),
  );
  return (found.Item as DoctorRecord | undefined) ?? null;
}

/**
 * Sessiya egasi shifokormi? Shifokorlar ham bemorlar kabi Telegram
 * orqali kiradi — farqi shundaki, ularning telegram_id si Doctors
 * jadvalida bog'langan bo'ladi.
 */
export async function doctorFor(session: Session): Promise<DoctorRecord | null> {
  const found = await db.send(
    new QueryCommand({
      TableName: TABLES.doctors,
      IndexName: 'telegram-index',
      KeyConditionExpression: 'telegram_id = :t',
      ExpressionAttributeValues: { ':t': session.userId },
      Limit: 1,
    }),
  );
  return (found.Items?.[0] as DoctorRecord | undefined) ?? null;
}
