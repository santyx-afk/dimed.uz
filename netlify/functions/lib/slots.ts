import { toTashkent, toInstant, isTime, type DateKey } from './time.ts';

export type Shift = { start: string; end: string };
export type Slot = { time: string; free: boolean };

/** Qabulga kamida shuncha daqiqa qolgan bo'lishi kerak — bron va ko'chirish uchun. */
export const MIN_LEAD_MINUTES = 60;

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined) throw new Error(`Vaqt formati noto'g'ri: ${hhmm}`);
  return h * 60 + m;
};

export const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Smenalardan slot vaqtlarini yasaydi. Smenalar orasidagi bo'shliq —
 * tanaffus, unga slot tushmaydi. Smena oxiriga to'liq sig'maydigan
 * qoldiq ham tashlab ketiladi.
 */
export function slotTimes(shifts: Shift[], slotMinutes: number): string[] {
  if (slotMinutes <= 0) throw new Error('slotMinutes musbat bo\'lishi kerak');

  const times: string[] = [];
  for (const shift of shifts) {
    const end = toMinutes(shift.end);
    for (let t = toMinutes(shift.start); t + slotMinutes <= end; t += slotMinutes) {
      times.push(toHHMM(t));
    }
  }
  // Smenalar tartibsiz kiritilgan bo'lsa ham natija o'sish tartibida bo'ladi.
  return [...new Set(times)].sort();
}

export type AvailabilityInput = {
  shifts: Shift[];
  slotMinutes: number;
  dateKey: DateKey;
  /** Band (yoki hali muddati o'tmagan hold) vaqtlar. */
  taken: Iterable<string>;
  now: Date;
};

/**
 * Kun uchun slotlar ro'yxati. Band bo'lganlari va boshlanishiga
 * 1 soatdan kam qolganlari `free: false` bo'ladi.
 */
export function availability({
  shifts,
  slotMinutes,
  dateKey,
  taken,
  now,
}: AvailabilityInput): Slot[] {
  const takenSet = new Set(taken);
  const current = toTashkent(now);

  return slotTimes(shifts, slotMinutes).map((time) => {
    const tooSoon = dateKey < current.dateKey ||
      (dateKey === current.dateKey && toMinutes(time) - current.minutes < MIN_LEAD_MINUTES);
    return { time, free: !takenSet.has(time) && !tooSoon };
  });
}

/** Slot shu shifokorning jadvalidagi haqiqiy slotmi? */
export function isValidSlot(shifts: Shift[], slotMinutes: number, time: string): boolean {
  return isTime(time) && slotTimes(shifts, slotMinutes).includes(time);
}

/**
 * Bron qilish yoki vaqtni ko'chirish mumkinmi.
 * Qabul boshlanishiga kamida 1 soat qolgan bo'lishi shart.
 */
export function isBookable(dateKey: DateKey, time: string, now: Date): boolean {
  const startsAt = toInstant(dateKey, time).getTime();
  return startsAt - now.getTime() >= MIN_LEAD_MINUTES * 60_000;
}

/** Appointments jadvalidagi bo'lim kaliti: "doctor_id#sana". */
export const doctorDayKey = (doctorId: string, dateKey: DateKey): string => `${doctorId}#${dateKey}`;
