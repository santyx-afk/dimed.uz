/**
 * Jadval ta'riflarini AWS'ga bormasdan tekshiradi.
 *
 * Sabab: `date-index` qo'shilganda `date` maydoni AttributeDefinitions
 * ro'yxatiga kiritilmagan edi. Xato faqat haqiqiy `CreateTable` da
 * chiqadi, ya'ni jadval yaratishga urinilgan paytda — o'shanda esa
 * `appointments` jadvali yaratilmasdan qolardi.
 *
 * DynamoDB ikki tomonlama qat'iy: kalit maydoni e'lon qilinmasa ham,
 * e'lon qilingan maydon hech qayerda ishlatilmasa ham rad etadi.
 *
 * Ishlatish: node scripts/test-tables.mjs
 */
import assert from 'node:assert/strict';
import { tables } from './tables.mjs';

let passed = 0;
const test = (name, fn) => {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
};

console.log('Jadval ta\'riflari:');

test('7 ta jadval', () => assert.equal(tables.length, 7));

test('har bir jadvalda nom, maydon va kalit bor', () => {
  for (const t of tables) {
    assert.ok(t.name, 'nom yo\'q');
    assert.ok(t.attrs?.length, `${t.name}: maydonlar yo'q`);
    assert.ok(t.keys?.length, `${t.name}: kalit yo'q`);
  }
});

test('barcha kalit maydonlari e\'lon qilingan', () => {
  for (const t of tables) {
    const declared = new Set(t.attrs.map((a) => a.AttributeName));

    for (const k of t.keys) {
      assert.ok(
        declared.has(k.AttributeName),
        `${t.name}: "${k.AttributeName}" kaliti AttributeDefinitions da yo'q`,
      );
    }

    for (const index of t.indexes ?? []) {
      for (const k of index.KeySchema) {
        assert.ok(
          declared.has(k.AttributeName),
          `${t.name}/${index.IndexName}: "${k.AttributeName}" AttributeDefinitions da yo'q`,
        );
      }
    }
  }
});

test('e\'lon qilingan har bir maydon biror kalitda ishlatilgan', () => {
  for (const t of tables) {
    const used = new Set([
      ...t.keys.map((k) => k.AttributeName),
      ...(t.indexes ?? []).flatMap((i) => i.KeySchema.map((k) => k.AttributeName)),
    ]);

    for (const a of t.attrs) {
      assert.ok(
        used.has(a.AttributeName),
        `${t.name}: "${a.AttributeName}" e'lon qilingan, lekin hech qayerda ishlatilmagan`,
      );
    }
  }
});

test('indeks nomlari takrorlanmaydi', () => {
  for (const t of tables) {
    const names = (t.indexes ?? []).map((i) => i.IndexName);
    assert.equal(new Set(names).size, names.length, `${t.name}: indeks nomi takrorlangan`);
  }
});

test('kodda ishlatiladigan indekslar mavjud', () => {
  const find = (name) => tables.find((t) => t.name === name);
  const indexNames = (name) => (find(name).indexes ?? []).map((i) => i.IndexName);

  // Bu indekslarga tayanadigan joylar: auth.ts, me.ts, cron'lar.
  assert.ok(indexNames('users').includes('phone-index'));
  assert.ok(indexNames('doctors').includes('telegram-index'));
  assert.ok(indexNames('appointments').includes('patient-index'));
  assert.ok(indexNames('appointments').includes('date-index'), 'cron eslatmalari shunga tayanadi');
});

test('otp_codes da TTL yoqiladi', () => {
  const otp = tables.find((t) => t.name === 'otp_codes');
  assert.equal(otp.ttlAttribute, 'expires_at');
});

console.log(`\n${passed} ta tekshiruv o'tdi.`);
