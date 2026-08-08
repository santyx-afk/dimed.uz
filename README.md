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
| `npm run create-tables` | DynamoDB jadvallarini yaratish (bir marta) |
| `npm run build-analyses` | `legacy/` dan tahlillar ro'yxatini yangilash |

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
scripts/          create-tables.mjs, build-analyses.mjs
docs/             1c-integration.md
legacy/           eski Jekyll sayti (arxiv, deploy qilinmaydi)
```

## API

| Endpoint | Vazifa | Holat |
| --- | --- | --- |
| `POST /api/telegram-webhook` | Bot: `/start`, kontakt qabul qilish, OTP yuborish | ✅ 1-hafta |
| `POST /api/auth-verify` | OTP kodni tekshirish, sessiya ochish | ✅ 1-hafta |
| `POST /api/lc-results` | 1C dan tahlil natijalari | ✅ 1-hafta |
| `GET /api/slots` | Bo'sh slotlar | 2-hafta |
| `POST /api/book` | Slotni band qilish + RHMT to'lov | 2-hafta |
| `POST /api/rhmt-webhook` | To'lov tasdig'i | 2-hafta |
| `POST /api/reschedule` | Vaqtni ko'chirish (1 soat qoidasi) | 3-hafta |

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

### 4. 1C

[`docs/1c-integration.md`](docs/1c-integration.md) ni laboratoriya
dasturchisiga bering.

## Eski sayt

Avvalgi Jekyll sayti `legacy/` papkasida saqlanmoqda — kontent manbasi
sifatida ishlatiladi (`npm run build-analyses`) va deploy qilinmaydi.
