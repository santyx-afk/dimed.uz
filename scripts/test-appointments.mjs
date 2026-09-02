/**
 * Bandlik qoidalari: hold muddati, bekor qilingan va ko'chirilgan
 * yozuvlar slotni bo'shatadimi.
 * Ishlatish: npm test
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'netlify', 'functions', 'lib');
const load = (file) => import(pathToFileURL(join(libDir, file)).href);

const { takenTimes, isConfirmed } = await load('appointments.ts');
const { availability } = await load('slots.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
};

const now = new Date('2026-08-20T05:00:00Z'); // Toshkentda 10:00
const sec = (d) => Math.floor(d.getTime() / 1000);

const appt = (time, status, holdUntil) => ({
  time,
  status,
  ...(holdUntil === undefined ? {} : { hold_until: holdUntil }),
});

console.log('Bandlik holatlari:');
test("to'langan qabul band", () => {
  assert.deepEqual(takenTimes([appt('09:00', 'paid')], now), ['09:00']);
});

test('klinikada to\'lash broni ham band', () => {
  assert.deepEqual(takenTimes([appt('09:00', 'booked')], now), ['09:00']);
});

test('yangi hold band', () => {
  const held = appt('09:00', 'hold', sec(now) + 120);
  assert.deepEqual(takenTimes([held], now), ['09:00']);
});

test("muddati o'tgan hold band emas", () => {
  const stale = appt('09:00', 'hold', sec(now) - 1);
  assert.deepEqual(takenTimes([stale], now), []);
});

test('hold_until yo\'q hold band emas (buzilgan yozuv)', () => {
  assert.deepEqual(takenTimes([appt('09:00', 'hold')], now), []);
});

test("bekor qilingan va ko'chirilgan yozuvlar slotni bo'shatadi", () => {
  const rows = [appt('09:00', 'cancelled'), appt('10:00', 'moved'), appt('11:00', 'paid')];
  assert.deepEqual(takenTimes(rows, now), ['11:00']);
});

test('klinika bekor qilgan navbat slotni bo\'shatadi', () => {
  const rows = [appt('09:00', 'cancelled_by_clinic'), appt('10:00', 'booked')];
  assert.deepEqual(takenTimes(rows, now), ['10:00']);
});

test('aralash holatlar to\'g\'ri ajratiladi', () => {
  const rows = [
    appt('08:00', 'paid'),
    appt('08:30', 'hold', sec(now) + 60),
    appt('09:00', 'hold', sec(now) - 60),
    appt('09:30', 'cancelled'),
    appt('10:00', 'booked'),
  ];
  assert.deepEqual(takenTimes(rows, now).sort(), ['08:00', '08:30', '10:00']);
});

console.log('\nKuchdagi bron (eslatma va ko\'chirish uchun):');
test("to'langan va klinikada to'lanadigan bronlar kuchda", () => {
  assert.equal(isConfirmed({ status: 'paid' }), true);
  assert.equal(isConfirmed({ status: 'booked' }), true);
});

test('hold, ko\'chirilgan va bekor qilinganlar kuchda emas', () => {
  for (const status of ['hold', 'moved', 'cancelled', 'cancelled_by_clinic', 'done']) {
    assert.equal(isConfirmed({ status }), false, `${status} kuchda bo'lmasligi kerak`);
  }
});

console.log('\nSlot ro\'yxatiga ta\'siri:');
test("muddati o'tgan hold slotni yana ochadi", () => {
  const shifts = [{ start: '14:00', end: '16:00' }];
  const stale = [appt('14:00', 'hold', sec(now) - 1)];
  const slots = availability({
    shifts,
    slotMinutes: 60,
    dateKey: '2026-08-20',
    taken: takenTimes(stale, now),
    now,
  });
  assert.equal(slots.find((s) => s.time === '14:00').free, true);
});

test("faol hold slotni yopadi", () => {
  const shifts = [{ start: '14:00', end: '16:00' }];
  const fresh = [appt('14:00', 'hold', sec(now) + 200)];
  const slots = availability({
    shifts,
    slotMinutes: 60,
    dateKey: '2026-08-20',
    taken: takenTimes(fresh, now),
    now,
  });
  assert.equal(slots.find((s) => s.time === '14:00').free, false);
});

console.log(`\n${passed} ta tekshiruv o'tdi.`);
