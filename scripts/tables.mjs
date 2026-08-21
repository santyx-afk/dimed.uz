/**
 * DynamoDB jadvallari ta'rifi.
 *
 * `create-tables.mjs` shu ro'yxat bo'yicha jadval yaratadi,
 * `test-tables.mjs` esa ta'riflarni AWS'ga bormasdan tekshiradi.
 * Shu sababli ta'riflar alohida faylda: skriptni import qilish
 * jadval yaratib yuborardi.
 */
const S = (name) => ({ AttributeName: name, AttributeType: 'S' });
const HASH = (name) => ({ AttributeName: name, KeyType: 'HASH' });
const RANGE = (name) => ({ AttributeName: name, KeyType: 'RANGE' });
const ALL = { ProjectionType: 'ALL' };

/** Har bir jadval: bepul chegarada qolish uchun PAY_PER_REQUEST. */
export const tables = [
  {
    // phone-index: kirish va tahlil natijalari telefon bo'yicha bog'lanadi.
    // code-index: 1C bemor kodi bo'yicha qidirish — profil sinxronizatsiyasi
    //   uchun. Sparse indeks: kodi hali biriktirilmagan bemor unga tushmaydi.
    name: 'users',
    attrs: [S('telegram_id'), S('phone'), S('code')],
    keys: [HASH('telegram_id')],
    indexes: [
      { IndexName: 'phone-index', KeySchema: [HASH('phone')], Projection: ALL },
      { IndexName: 'code-index', KeySchema: [HASH('code')], Projection: ALL },
    ],
  },
  {
    name: 'otp_codes',
    attrs: [S('phone')],
    keys: [HASH('phone')],
    ttlAttribute: 'expires_at',
  },
  {
    // 1C bemorlar katalogining ko'chirmasi. 1C o'zi yozadi: kalit —
    // telefon (+998...), sort_key="PROFILE". Sayt /start va har
    // kirishda shu yerdan o'qib, profilni dimed_users ga
    // birlashtiradi. 1C xohlagancha yozaveradi — saytga xalal yo'q.
    name: 'individuals',
    attrs: [S('phone'), S('sort_key')],
    keys: [HASH('phone'), RANGE('sort_key')],
  },
  {
    // telegram-index: shifokor o'z kabinetiga Telegram orqali kiradi
    name: 'doctors',
    attrs: [S('doctor_id'), S('telegram_id')],
    keys: [HASH('doctor_id')],
    indexes: [{ IndexName: 'telegram-index', KeySchema: [HASH('telegram_id')], Projection: ALL }],
  },
  {
    // PK: doctor_id, SK: sana — bir shifokorning kunlik smenalari
    name: 'schedules',
    attrs: [S('doctor_id'), S('date')],
    keys: [HASH('doctor_id'), RANGE('date')],
  },
  {
    // PK: "doctor_id#sana", SK: vaqt — slot bandligini atomik tekshirish uchun
    name: 'appointments',
    attrs: [S('doctor_day'), S('time'), S('phone'), S('starts_at'), S('date')],
    keys: [HASH('doctor_day'), RANGE('time')],
    indexes: [
      {
        IndexName: 'patient-index',
        KeySchema: [HASH('phone'), RANGE('starts_at')],
        Projection: ALL,
      },
      {
        // date-index: eslatma va kunlik xulosa cron'lari uchun — ular
        // butun klinika bo'yicha "shu kundagi navbatlar" ni so'raydi
        IndexName: 'date-index',
        KeySchema: [HASH('date'), RANGE('starts_at')],
        Projection: ALL,
      },
    ],
  },
  {
    // 1C laboratoriya natijalari — 1C o'zi yozadi: kalit telefon,
    // sort_key = hujjat UUID, ichida AnalysisResults ro'yxati.
    // Sayt /api/me da o'qib, har analitni alohida qatorga yoyadi.
    name: 'analysis_results',
    attrs: [S('phone'), S('sort_key')],
    keys: [HASH('phone'), RANGE('sort_key')],
  },
  {
    name: 'payments',
    attrs: [S('payment_id')],
    keys: [HASH('payment_id')],
  },
  {
    // PK: bemor telefoni, SK: "sana#kod"
    name: 'lab_results',
    attrs: [S('phone'), S('sort_key')],
    keys: [HASH('phone'), RANGE('sort_key')],
  },
];
