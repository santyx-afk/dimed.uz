/**
 * Tahlil (panel) nomini tanish — `netlify/functions/lib/panels.ts`.
 *
 * Ko'rsatkichlar ro'yxati bazadagi haqiqiy hujjatlardan olingan
 * (dimed_analysis_results, 3691 ta yozuvdagi eng ko'p uchraydigan
 * shakllar). Shu sababli tekshiruv "shunday bo'lsa kerak" emas,
 * klinikaning o'z ma'lumoti bo'yicha ishlaydi.
 *
 * Ishlatish: node --experimental-strip-types scripts/test-panels.mjs
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'netlify', 'functions', 'lib');
const { detectPanel } = await import(pathToFileURL(join(libDir, 'panels.ts')).href);

let passed = 0;
const test = (name, fn) => {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
};

// --- bazadagi haqiqiy hujjat shakllari ---

const QON_LEYKOFORMULA = [
  'Gemoglobin', 'Eritrotsitlar', 'Eritrotsitlar oʻrtacha hajmi',
  '1 dona Eritrotsitdagi gemoglobin miqdori', 'Eritrotsitdagi gemoglobin konsentratsiyasi',
  'Eritrotsitlar anizotsitozi', 'Eritrotsitlar hajmining stantart chetlanishi', 'Gematokrit',
  'Trombotsitlar', "Trombotsitlar o'rtacha hajmi", 'Trombotsitlar anizotsitozi', 'Trombokrit',
  'Leykotsitlar', 'Segment yadroli neytrofil', 'Eozinofillar', 'Bazofillar', 'Monotsitlar',
  'Limfotsitlar', 'Segment yadroli neytrofil', 'Eozinofillar', 'Bazofillar', 'Monotsitlar',
  'Limfotsitlar', 'Eritrotsitlar choʻkish tezligi',
];

const QON_14 = [
  'Gemoglobin', 'Eritrotsitlar', 'Eritrotsitlar oʻrtacha hajmi',
  'Eritrotsitlar hajmining stantart chetlanishi', '1 dona Eritrotsitdagi gemoglobin miqdori',
  'Eritrotsitdagi gemoglobin konsentratsiyasi', 'Eritrotsitlar anizotsitozi', 'Gematokrit',
  'Trombotsitlar', "Trombotsitlar o'rtacha hajmi", 'Trombotsitlar anizotsitozi', 'Trombokrit',
  'Leykotsitlar', 'Eritrotsitlar choʻkish tezligi',
];

const SIYDIK = [
  'Hajmi', 'Rangi', 'Tiniqligi', 'Leykotsitlar', 'Nitritlar', 'Urobilinogen', 'Oqsil',
  'Siydik kislotalilik darajasi', 'Qon', 'Nisbiy Zichligi', 'Atseton', 'Bilirubun', 'Glyukoza',
  'Askorbin kislotasi', 'Askorbin/Kreatinin', 'Kreatinin', 'Mikro albumin', 'Epiteliy yassi',
  "Epiteliy o'tuvchi", 'Epiteliy buyrak', 'Leykotsitlar', "Eritrotsitlar o'zgarmagan",
  "Eritrotsitlar o'zgargan", 'Silindrlar', 'Shilliq Siydikda mikroskopda',
  'Bakteriyalar Siydikda mikroskopda', 'Tuzlar', 'Zamburugʻlar siydikda', 'Eyakulyat elementlari',
];

const NAJAS = [
  'Shakli', 'Rangi', 'Shilliq', 'Qon', "Hazm bo'lmagan ovqat qoldig'i", 'Biriktruvchi toʻqima',
  'Neytral yogʻ', 'Yogʻ kislotalari', 'Sovun', "Hazm bo'lmagan oʻsimlik tolasi", 'Kraxmal',
  'Yodofil flora', 'Kristallar', 'Shilliq mikroskopda', 'Epiteliy', 'Leykotsitlar',
  'Eritrotsitlar', 'Sodda hayvonlar', 'Gijja tuxumlari', 'Zamburugʻlar',
];

const KOAGULOGRAMMA = [
  'Fibrinogen', "Protrombin indeksi (Kvik bo'yicha vaqti)", 'Protrombin vaqti',
  'Qisman tromboplastin faollanish vaqti (АЧТВ)', 'Qisman tromboplastin faollanish vaqti (Nisbat)',
  'MHO', 'Trombin vaqti', 'Trombin vaqti (nisbat)',
];

const BIOKIMYO = ['ALT', 'AST', 'Umumiy oqsil', 'Mochevina', 'Kreatinin', 'Glyukoza'];
const REVMOPROBA = ['Antistreptolizin-O', 'C-reaktiv oqsili', 'Revmatoid faktor'];
const EKSPRESS = ['Gepatit B ekspress test HBs Ag', 'Gepatit C ekspress test HCV Ab'];

const key = (names) => detectPanel(names)?.key ?? null;

console.log('Tahlil panelini tanish:');

test('umumiy qon tahlili (leykoformula bilan, 24 ta)', () =>
  assert.equal(key(QON_LEYKOFORMULA), 'panel.cbc'));

test('umumiy qon tahlili (14 ta)', () => assert.equal(key(QON_14), 'panel.cbc'));

test('umumiy siydik tahlili (29 ta)', () => assert.equal(key(SIYDIK), 'panel.urine'));

test('najas tahlili (20 ta)', () => assert.equal(key(NAJAS), 'panel.stool'));

test('koagulogramma', () => assert.equal(key(KOAGULOGRAMMA), 'panel.coagulogram'));

test('biokimyoviy qon tahlili', () => assert.equal(key(BIOKIMYO), 'panel.biochem'));

test('ikki ko\'rsatkichli biokimyo ham tanildi', () =>
  assert.equal(key(['ALT', 'AST']), 'panel.biochem'));

test('revmoproba', () => assert.equal(key(REVMOPROBA), 'panel.rheuma'));

test('ekspress testlar', () => assert.equal(key(EKSPRESS), 'panel.express'));

test('TORCH infeksiyalari', () =>
  assert.equal(
    key([
      'Toksoplazmoz IgG', 'Toksoplazmoz IgM', 'Qizamiq IgG', 'Qizamiq IgM',
      'Sitomegalovirus IgG', 'Sitomegalovirus IgM',
    ]),
    'panel.torch',
  ));

// --- panellar bir-biriga o'xshab ketmasligi kerak ---

test('siydik qon tahlili deb tanilmaydi', () => {
  // Ikkalasida ham Leykotsitlar, Eritrotsitlar, Glyukoza, Kreatinin bor.
  assert.equal(key(SIYDIK), 'panel.urine');
  assert.notEqual(key(SIYDIK), 'panel.cbc');
});

test('koagulogramma biokimyo deb tanilmaydi', () => {
  // "tromboPLASTin" ichida "ast" bor — qisqa qisqartmalar faqat
  // to'liq tenglik bilan izlanadi.
  assert.equal(key(KOAGULOGRAMMA), 'panel.coagulogram');
});

test('najas qon tahlili deb tanilmaydi', () => assert.equal(key(NAJAS), 'panel.stool'));

// --- tanilmaydigan holatlar: sarlavha ko'rsatkich nomidan yasaladi ---

test('bitta ko\'rsatkich — panel emas', () => {
  assert.equal(key(['Gemoglobin']), null);
  assert.equal(key(['Glyukoza']), null);
});

test('bog\'liq bo\'lmagan ikki ko\'rsatkich — panel emas', () =>
  assert.equal(key(['Kalsiy', 'Temir']), null));

test('bo\'sh ro\'yxat — panel emas', () => assert.equal(key([]), null));

test('nom apostrof va katta harfga bog\'liq emas', () => {
  const boshqacha = QON_14.map((n) => n.toUpperCase().replace(/ʻ/g, "'"));
  assert.equal(key(boshqacha), 'panel.cbc');
});

console.log(`\n${passed} ta tekshiruv o'tdi.`);
