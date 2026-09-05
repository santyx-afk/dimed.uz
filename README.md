# dimed.uz

Dimed klinikasi (Chinoz) sayti: onlayn navbat, Telegram orqali kirish,
shaxsiy kabinet va laboratoriya natijalari.

**Stack:** Astro + Tailwind CSS + TypeScript · Netlify Functions · Amazon DynamoDB + S3 · Telegram Bot API

## Ishga tushirish

```bash
npm install
cp .env.example .env    # qiymatlarni to'ldiring
npm run dev             # http://localhost:4321
```

| Buyruq | Vazifa |
| --- | --- |
| `npm run dev` | Lokal server |
| `npm run build` | Saytni `dist/` ga yig'ish |
| `npm run preview` | Yig'ilgan saytni ko'rish |
| `npm run typecheck` | Astro va funksiyalar tiplarini tekshirish |
| `npm test` | Barcha tekshiruvlar (mantiq + API) |
| `npm run create-tables` | DynamoDB jadvallarini yaratish (bir marta) |
| `npm run seed-doctors` | Shifokorlarni bazaga yozish |
| `npm run build-analyses` | `legacy/` dan tahlillar ro'yxatini yangilash |

Testlar haqiqiy AWS'siz ishlaydi: `scripts/fake-dynamo.mjs` xotirada
DynamoDB o'rnini bosadi, Telegram chaqiruvlari esa ushlab qolinadi.

## Loyiha tuzilishi

```
src/
  components/     Astro komponentlari (Nav, Footer, BookingWidget…)
  data/           doctors.ts, departments.ts, site.ts, analyses.json
  layouts/        Base.astro — umumiy sahifa qolipi
  pages/          index.astro, tahlillar.astro
  styles/         global.css (dizayn tokenlari), fonts.css
netlify/
  functions/      API (TypeScript)
    lib/          db, telegram, session, env, http
scripts/          create-tables, seed-doctors, link-doctor, build-analyses
docs/             ISHGA-TUSHIRISH, HANDOFF, 1c-integration, rhmt-integration
legacy/           eski Jekyll sayti (arxiv, deploy qilinmaydi)
```

## API

| Endpoint | Vazifa | Holat |
| --- | --- | --- |
| `POST /api/telegram-webhook` | Bot: `/start`, kontakt qabul qilish, OTP yuborish | ✅ 1-hafta |
| `POST /api/auth-verify` | OTP kodni tekshirish, sessiya ochish | ✅ 1-hafta |
| `POST /api/logout` | Sessiyani tugatish | ✅ 2-hafta |
| `POST /api/lc-results` | 1C dan tahlil natijalari | ✅ 1-hafta |
| `GET /api/slots` | Bo'sh slotlar (shifokor + sana) | ✅ 2-hafta |
| `POST /api/book` | Slotni atomik band qilish (to'lov kassada) | ✅ 2-hafta |
| `POST /api/payment-webhook` | Payme webhook (PAYMENT_ENABLED=1 bo'lsagina) | ⏸ o'chiq |
| `GET /api/me` | Bemor: qabullari va tahlillari | ✅ 2-hafta |
| `GET /api/result-file` | Tahlil PDF'iga vaqtinchalik havola | ✅ 2-hafta |
| `GET,POST /api/doctor-schedule` | Shifokor: smenalar, slot davomiyligi, navbat | ✅ 2-hafta |
| `POST /api/reschedule` | Vaqtni ko'chirish (1 soat qoidasi) | ✅ 3-hafta |
| `POST /api/doctor-off` | «Shifokor ishga chiqa olmadi»: kunni yopish | ✅ 3-hafta |

### Rejalashtirilgan funksiyalar (cron)

Netlify Scheduled Functions — tashqaridan chaqirilmaydi, faqat jadval bo'yicha:

| Funksiya | Jadval (UTC) | Vazifa |
| --- | --- | --- |
| `remind-patients` | `*/10 * * * *` | Qabulga ~1 soat qolgan bemorlarga eslatma |
| `doctor-daily` | `0 2 * * *` | Toshkentda 07:00 — shifokorga «bugungi navbatlaringiz» |

Ikkalasi ham takror yubormaydi: eslatma yozuvdagi `reminded_at`, kunlik
xulosa esa `schedules` dagi `summary_sent_at` bilan bir martaga bog'langan.

### Slot va bron qoidalari

- Slotlar shifokorning smenalaridan hisoblanadi; smenalar orasidagi
  bo'shliq — tanaffus, unga slot tushmaydi.
- Qabul boshlanishiga **kamida 1 soat** qolgan bo'lishi kerak.
- Slot DynamoDB shartli yozuvi bilan band qilinadi — ikki bemor bitta
  slotni ola olmaydi (ikkinchisiga 409 qaytadi).
- Bron darhol kuchga kiradi, to'lov qabulxona kassasida. (Onlayn
  to'lov yoqilsa slot 5 daqiqaga *hold* qilinadi va to'lov o'tmasa
  avtomatik bo'shaydi.)
- Klinika vaqti — Asia/Tashkent (UTC+5), server UTC'da ishlasa ham.
- **Bekor qilish yo'q** — bemor faqat vaqtni ko'chira oladi, shifokor
  o'zgarmaydi. Eski yozuv `moved` bo'ladi va sloti bo'shaydi.
- Shifokor kunni yopsa (`/api/doctor-off`) o'sha kundagi navbatlar
  `cancelled_by_clinic` bo'ladi, bemorlarga bot orqali xabar ketadi va
  slotlar bo'shaydi.

### To'lov rejimi

Onlayn to'lov ishlatilmaydi: sayt **"qabulxona kassasida to'lash"**
rejimida ishlaydi — bemor slotni band qiladi, tasdiqlash qadamida
narx va «Qabulxona kassasiga X so'm to'laysiz» matni ko'rinadi, to'lov
klinikada. Payme integratsiya kodi (`lib/payment.ts`,
`payment-webhook.ts`) saqlangan, lekin global `PAYMENT_ENABLED`
sozlamasi ortida o'chiq (standart — bo'sh). Kelajakda qaytarish:
`PAYMENT_ENABLED=1` + Payme kalitlari — bron mantig'i o'zgarmaydi.

## Sozlash (bir martalik)

### 1. Telegram botlar

1. [@BotFather](https://t.me/BotFather) da `/newbot` — asosiy bot yarating,
   tokenni `TELEGRAM_BOT_TOKEN` ga yozing.
2. Yana bir bot yarating (xatolar uchun) — `TELEGRAM_LOG_BOT_TOKEN`.
   Log-botni yopiq guruhga qo'shing va guruh id sini `TELEGRAM_LOG_CHAT_ID` ga yozing.
3. Webhook'ni ulang:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://dimed.uz/api/telegram-webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

### 2. AWS

```bash
npm run create-tables    # 7 ta jadval, PAY_PER_REQUEST
```

PDF fayllar uchun S3 bucket yarating (ommaviy kirish **yopiq**) va nomini
`LAB_S3_BUCKET` ga yozing.

### 3. Netlify

Reponi ulang — `netlify.toml` dagi sozlamalar avtomatik qo'llanadi.
Barcha `.env.example` dagi o'zgaruvchilarni Netlify environment
variables bo'limiga qo'shing.

### 4. Integratsiyalar

[`docs/1c-integration.md`](docs/1c-integration.md) ni laboratoriya
dasturchisiga bering, [`docs/rhmt-integration.md`](docs/rhmt-integration.md)
ni esa to'lov tizimini ulaydigan dasturchiga.

## Hujjatlar

| Fayl | Kim uchun |
| --- | --- |
| [`docs/ISHGA-TUSHIRISH.md`](docs/ISHGA-TUSHIRISH.md) | Klinika egasi — qadamma-qadam ishga tushirish |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Sayt dasturchisi — texnik qarorlar, kod tuzilishi, tuzoqlar |
| [`docs/1c-integration.md`](docs/1c-integration.md) | 1C dasturchisi — tahlil natijalarini yuborish |
| [`docs/rhmt-integration.md`](docs/rhmt-integration.md) | To'lov dasturchisi — RHMT dan nima so'rash va qayerga yozish |

## Eski sayt

Avvalgi Jekyll sayti `legacy/` papkasida saqlanmoqda — kontent manbasi
sifatida ishlatiladi (`npm run build-analyses`) va deploy qilinmaydi.
