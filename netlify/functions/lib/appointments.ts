import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';
import { doctorDayKey } from './slots.ts';
import type { DateKey } from './time.ts';

export type AppointmentStatus = 'hold' | 'paid' | 'moved' | 'cancelled';

export type Appointment = {
  doctor_day: string;
  time: string;
  doctor_id: string;
  date: DateKey;
  phone: string;
  starts_at: string;
  status: AppointmentStatus;
  price: number;
  /** hold uchun: shu vaqtdan keyin slot yana bo'shaydi (unix sekund) */
  hold_until?: number;
  payment_id?: string;
  created_at: string;
};

/** Shu kundagi barcha yozuvlar (hold va to'langanlar). */
export async function dayAppointments(
  doctorId: string,
  dateKey: DateKey,
): Promise<Appointment[]> {
  const found = await db.send(
    new QueryCommand({
      TableName: TABLES.appointments,
      KeyConditionExpression: 'doctor_day = :k',
      ExpressionAttributeValues: { ':k': doctorDayKey(doctorId, dateKey) },
    }),
  );
  return (found.Items ?? []) as Appointment[];
}

/**
 * Band hisoblanadigan vaqtlar. Muddati o'tgan hold band emas —
 * DynamoDB TTL kechikishi mumkin, shuning uchun o'zimiz tekshiramiz.
 */
export function takenTimes(appointments: Appointment[], now: Date): string[] {
  const nowSec = Math.floor(now.getTime() / 1000);
  return appointments
    .filter((a) => {
      if (a.status === 'cancelled' || a.status === 'moved') return false;
      if (a.status === 'hold') return (a.hold_until ?? 0) > nowSec;
      return true;
    })
    .map((a) => a.time);
}
