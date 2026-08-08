import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';
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
};

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
