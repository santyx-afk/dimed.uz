/**
 * Shifokor jadvalini tekshirish qoidalari.
 * Ishlatish: npm test
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'netlify', 'functions', 'lib');
const load = (file) => import(pathToFileURL(join(libDir, file)).href);

const { checkShifts, isAllowedSlotMinutes, maskPhone } = await load('schedule.ts');
const { slotTimes } = await load('slots.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
};

console.log('Smenalarni tekshirish:');
test('oddiy ikki smena qabul qilinadi', () => {
  const r = checkShifts([
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.shifts.length, 2);
});

test('smenalar vaqt bo\'yicha tartiblanadi', () => {
  const r = checkShifts([
    { start: '14:00', end: '18:00' },
    { start: '08:00', end: '12:00' },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.shifts[0].start, '08:00');
  assert.equal(r.shifts[1].start, '14:00');
});

test('bo\'sh ro\'yxat rad etiladi', () => {
  assert.equal(checkShifts([]).ok, false);
  assert.equal(checkShifts(null).ok, false);
  assert.equal(checkShifts('09:00').ok, false);
});

test('4 tadan ko\'p smena rad etiladi', () => {
  const many = Array.from({ length: 5 }, (_, i) => ({
    start: `0${i + 1}:00`,
    end: `0${i + 1}:30`,
  }));
  assert.equal(checkShifts(many).ok, false);
});

test('teskari smena rad etiladi', () => {
  assert.equal(checkShifts([{ start: '17:00', end: '09:00' }]).ok, false);
});

test('nol uzunlikdagi smena rad etiladi', () => {
  assert.equal(checkShifts([{ start: '09:00', end: '09:00' }]).ok, false);
});

test('noto\'g\'ri format rad etiladi', () => {
  assert.equal(checkShifts([{ start: '9:00', end: '17:00' }]).ok, false);
  assert.equal(checkShifts([{ start: '25:00', end: '26:00' }]).ok, false);
  assert.equal(checkShifts([{ start: 'ertalab', end: 'kechqurun' }]).ok, false);
  assert.equal(checkShifts([{}]).ok, false);
});

test('ustma-ust tushgan smenalar rad etiladi', () => {
  const r = checkShifts([
    { start: '08:00', end: '13:00' },
    { start: '12:00', end: '17:00' },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.message, /ustiga tushmasligi/);
});

test('yonma-yon smenalar (tanaffussiz) qabul qilinadi', () => {
  const r = checkShifts([
    { start: '08:00', end: '12:00' },
    { start: '12:00', end: '16:00' },
  ]);
  assert.equal(r.ok, true, 'tegib turgan smenalar ustma-ust emas');
});

test('tanaffus slotlarga tushmaydi', () => {
  const r = checkShifts([
    { start: '13:30', end: '16:00' },
    { start: '08:30', end: '12:30' },
  ]);
  const times = slotTimes(r.shifts, 30);
  assert.ok(!times.includes('12:30'), 'tanaffus boshlanishi');
  assert.ok(!times.includes('13:00'), 'tanaffus ichi');
  assert.ok(times.includes('13:30'), 'ikkinchi smena boshi');
});

console.log('\nQabul davomiyligi:');
test('ruxsat etilganlar', () => {
  for (const m of [10, 15, 20, 30]) assert.equal(isAllowedSlotMinutes(m), true);
});

test('boshqa qiymatlar rad etiladi', () => {
  for (const m of [0, 7, 45, 60, -15, '15', null, undefined]) {
    assert.equal(isAllowedSlotMinutes(m), false, `${m} o'tib ketdi`);
  }
});

console.log('\nTelefon niqobi:');
test('o\'rtasi yashiriladi', () => {
  const masked = maskPhone('+998901234567');
  assert.equal(masked, '+998901•••67');
  assert.ok(!masked.includes('2345'), 'o\'rtadagi raqamlar ko\'rinmasin');
});

test('qisqa qiymat o\'zgarmaydi', () => {
  assert.equal(maskPhone('12345'), '12345');
});

console.log(`\n${passed} ta tekshiruv o'tdi.`);
