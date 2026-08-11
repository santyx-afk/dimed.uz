# Dimed.uz — loyiha holati va davom ettirish uchun qo'llanma

> Bu hujjat yangi seansda ishni davom ettirish uchun. Oxirgi yangilanish:
> 1—3-haftaning kod qismi `master` ga merge qilingan va tekshirilgan holat
> (typecheck 0 xato, 64 mantiq + 42 API testi o'tadi, build muammosiz).
> Keyingi bosqich — beta-test va deploy; ular kalitlarga bog'liq.

## Loyiha nima

Chinoz shahridagi **Dimed** ko'p ixtisosli tibbiy markazi uchun yangi sayt:
onlayn navbat, Telegram orqali kirish, bemor va shifokor shaxsiy kabinetlari,
1C laboratoriya tizimidan avtomatik tahlil natijalari.

Eski sayt — Jekyll'da edi, u `legacy/` papkasiga arxivlangan (o'chirilmagan:
tahlillar va narxlar shu yerdan olinadi, deploy qilinmaydi).

**Stack:** Astro 5 + Tailwind 4 + TypeScript · Netlify Functions ·
Amazon DynamoDB + S3 · Telegram Bot API · RHMT (hali ulanmagan)

**Repo:** `santyx-afk/dimed.uz`, asosiy branch — `master`

---

## Biznes-mantiq (kelishilgan qoidalar)

- **Autentifikatsiya faqat Telegram orqali.** SMS yo'q, parol yo'q. Bemor botga
  `/start` yuboradi, kontaktini ulashadi, 6 xonali OTP oladi (5 daqiqa amal
  qiladi, bir martalik), uni saytga kiritadi.
- **Smenalar va tanaffuslar.** Har bir shifokor kuniga bir nechta smena
  belgilaydi (masalan 08:30–12:30 va 13:30–16:00). Smenalar orasidagi
  bo'shliq — tanaffus, unga slot tushmaydi. Slot davomiyligini ham shifokor
  o'zi tanlaydi (10/15/20/30 daqiqa).
- **1 soat qoidasi.** Qabul boshlanishiga kamida 1 soat qolgan bo'lishi kerak —
  ham bron qilish, ham vaqtni ko'chirish uchun. Roppa-rosa 60 daqiqa —
  **ruxsat etiladi** («kamida» shartiga mos).
- **Bekor qilish yo'q.** Bemor faqat boshqa vaqtga ko'chira oladi, shifokor
  o'zgarmaydi (boshqa shifokorga o'tish — bu yangi bron).
- **Klinika vaqti — Asia/Tashkent (UTC+5).** Server UTC'da ishlaydi, shuning
  uchun sana/vaqt hisoblari faqat `lib/time.ts` orqali qilinadi.
- **Bir slot — bir bemor.** DynamoDB shartli yozuvi bilan kafolatlanadi.

---

## Bajarilgan ishlar

### 1-hafta ✅
- Repo qayta tuzildi: Jekyll → `legacy/`, o'rniga Astro loyihasi
- Astro + Tailwind + TypeScript skeleti, Netlify sozlamalari
- Dizayn Astro komponentlariga ko'chirildi (bosh sahifa, tahlillar sahifasi)
- Shriftlar o'z serverimizda (woff2), shifokor rasmlari webp (423KB → 103KB)
- `telegram-webhook`, `auth-verify` (OTP + imzolangan HttpOnly sessiya)
- `lc-results` — 1C dan natijalar (matn → DynamoDB, PDF → S3)
- Admin log-bot: har qanday xato Telegram guruhga
- `create-tables.mjs` — 7 ta DynamoDB jadvali
- `docs/1c-integration.md` — 1C dasturchisi uchun spetsifikatsiya

### 2-hafta ✅
- **Umumiy mantiq** (`netlify/functions/lib/`): `time.ts` (UTC+5),
  `slots.ts` (slot yasash, 1 soat qoidasi), `appointments.ts` (hold muddati),
  `schedule.ts` (smenalarni tekshirish), `payment.ts` (to'lov adapteri)
- **API:** `/api/slots`, `/api/book` (atomik), `/api/payment-webhook`,
  `/api/me`, `/api/result-file`, `/api/doctor-schedule`, `/api/logout`
- **Sahifalar:** `/kirish` (OTP), `/kabinet` (bemor), `/kabinet/shifokor`
- Navbat vidjeti real API'ga ulandi (avval brauzerda taqlid qilardi)
- SEO: `robots.txt`, `sitemap.xml`
- `seed-doctors.mjs` — shifokorlarni bazaga yozish

### 3-hafta ✅ (kod qismi)
- **`POST /api/reschedule`** — vaqtni ko'chirish. Avval yangi slot atomik
  egallanadi, keyin eskisi `moved` bo'ladi; ikkinchi qadam yiqilsa yangi
  yozuv qaytarib olinadi (bitta bemorda ikkita navbat qolmasin).
- **Bemor kabinetida «Vaqtni ko'chirish»** — sana tanlanadi, bo'sh slotlar
  `/api/slots` dan yuklanadi, tanlangani `/api/reschedule` ga ketadi.
- **`POST /api/doctor-off`** — «bugun ishga chiqa olmayman»: kun yopiladi,
  o'sha kundagi navbatlar `cancelled_by_clinic` bo'ladi, har bir bemorga
  bot orqali uzr xabari boradi, slotlar bo'shaydi.
- **Eslatmalar (cron):** `remind-patients` (har 10 daqiqada, qabulga ~1 soat
  qolganda) va `doctor-daily` (Toshkentda 07:00, «bugungi navbatlaringiz»).
- `appointments` jadvaliga **`date-index` GSI** qo'shildi — cron'lar butun
  klinika bo'yicha «shu kundagi navbatlar» ni bitta so'rovda oladi.

### Qolgan ish
1. **Beta-test** — 1 bo'lim (taklif: Pediatriya) real rejimda
2. **Production deploy** — barcha 6 bo'lim, dimed.uz domenini Netlify'ga

---

## Kod tuzilishi

```
src/
  components/   Nav, Footer, Logo, DeptIcon, BookingWidget
  data/         doctors.ts, departments.ts, site.ts, analyses.json (43 ta tahlil)
  layouts/      Base.astro
  pages/        index, tahlillar, kirish, kabinet, kabinet/shifokor,
                robots.txt.ts, sitemap.xml.ts
  styles/       global.css (dizayn tokenlari), fonts.css
netlify/functions/
  lib/          db, env, http, session, telegram, time, slots,
                appointments, schedule, auth, payment
  *.ts          har bir fayl — bitta /api/<nom> endpoint
  remind-patients.ts, doctor-daily.ts — cron (config.schedule)
scripts/        create-tables, seed-doctors, build-analyses,
                fake-dynamo (testlar uchun), test-*.mjs
legacy/         eski Jekyll sayti (kontent manbasi, deploy qilinmaydi)
```

### Buyruqlar
```bash
npm run dev          # lokal server
npm run build        # dist/ ga yig'ish
npm run typecheck    # astro check + tsc
npm test             # 73 mantiq + 44 API testi
npm run create-tables
npm run seed-doctors
npm run link-doctor  # shifokorni Telegram'ga bog'lash (argumentsiz — ro'yxat)
```

### Testlar haqida
Testlar **haqiqiy AWS'siz** ishlaydi: `scripts/fake-dynamo.mjs` xotirada
DynamoDB o'rnini bosadi (PutItem, GetItem, UpdateItem, Query va
ConditionExpression'larni tushunadi), Telegram chaqiruvlari `globalThis.fetch`
orqali ushlab qolinadi. `scripts/test-api.mjs` butun oqimni sinaydi:
bot → OTP → sessiya → bron → ko'chirish → eslatma → kunlik xulosa →
shifokor chiqmadi.

Cron funksiyalari ham shu yerda sinaladi: 1 soat qoidasi sababli bron API'si
«30 daqiqadan keyingi» yozuvni yarata olmaydi, shuning uchun eslatma testi
yozuvni `seed()` bilan to'g'ridan-to'g'ri qo'yadi.

**Sanalar Toshkent kalendari bo'yicha olinadi.** `BOOK_DATE` — bugundan
ikki kun keyin: eslatma testining «30 daqiqadan keyingi» yozuvi Toshkentda
yarim tunga yaqin ertangi kunga tushib, «shifokor chiqmadi» testi bilan
kesishardi. Avval sana UTC bo'yicha hisoblanardi va testlar sutkasiga
330 daqiqa yiqilardi.

**CI:** `.github/workflows/ci.yml` har PR va master'ga push'da
`typecheck → test → build` ni yurgizadi. Kalit kerak emas — testlar
soxta DynamoDB bilan ishlaydi.

TypeScript fayllar testlarda `node --experimental-strip-types` bilan
to'g'ridan-to'g'ri import qilinadi — shuning uchun `lib/` ichidagi importlar
`.ts` kengaytmasi bilan yozilgan (`allowImportingTsExtensions: true`).

---

## DynamoDB sxemasi

| Jadval | PK / SK | Izoh |
| --- | --- | --- |
| `users` | `telegram_id` | GSI: `phone-index` |
| `otp_codes` | `phone` | TTL: `expires_at` |
| `doctors` | `doctor_id` | GSI: `telegram-index` (shifokor kabineti uchun) |
| `schedules` | `doctor_id` / `date` | kunlik alohida jadval, `day_off`, `summary_sent_at` |
| `appointments` | `doctor_day` / `time` | `doctor_day` = `"<doctor_id>#<sana>"`, GSI: `patient-index` (`phone`/`starts_at`), `date-index` (`date`/`starts_at`) |
| `payments` | `payment_id` | |
| `lab_results` | `phone` / `sort_key` | `sort_key` = `"<sana>#<kod>"`, PDF S3'da |

**Bron holatlari:** `hold` (5 daqiqa, onlayn to'lov uchun) → `paid`;
`booked` (klinikada to'lash — darhol kuchga kiradi); `done`; `moved`;
`cancelled`; `cancelled_by_clinic` (shifokor chiqmadi).

Holatlar bilan ishlash `lib/appointments.ts` da markazlashgan:
- `holdsSlot()` — yozuv slotni band qilib turibdimi (muddati o'tgan hold —
  yo'q; `moved` / `cancelled*` — yo'q). DynamoDB TTL kechikishiga tayanilmaydi.
- `isConfirmed()` — bron kuchdami (`paid` yoki `booked`). Eslatma, ko'chirish
  va kunlik xulosa faqat shularga tegishli.

---

## Muhim qarorlar va tuzoqlar

1. **To'lov hozircha «klinikada to'lash» rejimida.** RHMT kalitlari yo'q edi,
   shuning uchun rejadagi B varianti ishlayapti: slot band qilinadi, to'lov
   qabulxonada. `lib/payment.ts` — adapter. Kalitlar kelganda o'sha fayldagi
   `createPayment` to'ldiriladi va `RHMT_ENABLED=1` qilinadi; bron mantig'i
   o'zgarmaydi. To'liq spetsifikatsiya: `docs/rhmt-integration.md`.

   **Shifokorning `telegram_id` si qo'lda bog'lanadi.** `seed-doctors` uni
   yozmaydi — aks holda har seed'da bog'lanish o'chib ketardi. Buning
   uchun `npm run link-doctor` bor (telefon yoki id bo'yicha, bitta
   akkaunt ikkita shifokorga biriktirilmaydi). Bu qadam unutilsa bemor
   tomoni ishlaydi, shifokor esa kabinetiga kira olmaydi.

2. **`define:vars` bo'lgan `<script>` inline bo'ladi** va DOM to'liq
   yuklanishidan oldin ishga tushadi. Shuning uchun BookingWidget'dagi
   «Navbat olish» tugmalari **event delegatsiya** orqali ushlanadi. Kabinet
   sahifasidagi ko'chirish tugmalari ham shunday — kartochkalar har safar
   `innerHTML` bilan qaytadan chiziladi.

3. **Astro scoped CSS bola komponentga o'tmaydi.** `Logo.astro` ga `class`
   berish ishlamagan (o'lcham qo'llanmagan) — endi `height` prop orqali
   atributda beriladi.

4. **`<template>` ichidagi tugunlar `document.querySelectorAll` bilan
   topilmaydi** — faqat `template.content` orqali.

5. **`/api/slots` keshlanmaydi** (`no-store`). Avval 20 soniya keshlangan edi:
   bron qilgan bemor orqaga qaytsa o'z slotini yana bo'sh ko'rib 409 olardi.

6. **Vidjetdagi kun tugmalari endi serverdan tuzatiladi.** `/api/slots`
   har bir javobda `workdays` ni qaytaradi. Statik `doctors.ts` faqat
   birinchi chizishga ishlatiladi (sahifa darhol ko'rinsin), birinchi
   javob kelishi bilan server ro'yxati ustun bo'ladi va tugmalar qayta
   chiziladi. Shifokor kabinetidan kun qo'shsa ham, olib tashlasa ham
   bemor to'g'ri kunlarni ko'radi.

7. **Cron eslatmalari takror yubormaydi.** `remind-patients` avval yozuvni
   `reminded_at` bilan shartli belgilaydi, keyin xabar yuboradi — ishga
   tushishlar ustma-ust kelsa ham bemorga ikkita xabar bormaydi. Xabar
   ketmay qolsa admin log-botga tushadi (bu ikki marta eslatishdan yaxshiroq).
   Kunlik xulosa `schedules.summary_sent_at` bilan xuddi shunday himoyalangan.

8. **Eslatma oynasi 70 daqiqa**, 60 emas: cron 10 daqiqada bir ishlaydi,
   tor oynada ikki ishga tushish orasiga tushib qolgan qabul eslatmasiz
   qolardi.

9. **`doctor-off` avval kunni yopadi, keyin navbatlarni bekor qiladi** —
   teskari tartibda bo'shagan slotni yangi bemor ilib ketishi mumkin edi.

---

## Foydalanuvchidan kutilayotgan narsalar (0-bosqich)

Bularsiz sayt real ishlay olmaydi (kod tayyor, kalitlar yo'q):

- [ ] **Telegram bot tokenlari** — asosiy bot va log-bot (@BotFather), log-bot
      uchun guruh id
- [ ] **AWS** — akkaunt, IAM kalitlari, S3 bucket nomi
- [ ] **Netlify** — repo ulanishi, environment variables
- [ ] **RHMT** — merchant API kalitlari va hujjatlar (eng ko'p kutish
      chiqishi mumkin bo'lgan qism)
- [ ] **1C** — laboratoriya dasturchisiga `docs/1c-integration.md` berilishi
- [ ] **dimed.uz DNS** — domenni Netlify'ga yo'naltirish huquqi
- [ ] **Yakuniy narxlar va jadvallar** — `src/data/doctors.ts` dagi qiymatlar
      taxminiy, shifokorlar bilan tasdiqlash kerak

### Muhit o'zgaruvchilari
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LOG_BOT_TOKEN`,
`TELEGRAM_LOG_CHAT_ID`, `SESSION_SECRET`, `DIMED_AWS_REGION`,
`DIMED_TABLE_PREFIX`, `DIMED_AWS_ACCESS_KEY_ID`, `DIMED_AWS_SECRET_ACCESS_KEY`,
`LAB_S3_BUCKET`, `LC_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, `RHMT_ENABLED`

To'liq izohlar bilan — `.env.example`.

> **Eslatma:** jadvallar allaqachon yaratilgan bo'lsa, `date-index` GSI
> qo'shilishi kerak — `create-tables.mjs` mavjud jadvalni o'tkazib yuboradi.
> Uni AWS konsolida qo'lda qo'shish yoki jadvalni qayta yaratish lozim.

---

## Ish uslubi (shu loyihada kelishilgan)

- Muloqot va kod izohlari — **o'zbek tilida**
- Har bir o'zgarishdan keyin: `npm run typecheck && npm test && npm run build`
- Yangi mantiq yozilsa — unga test ham yoziladi (`scripts/test-*.mjs`)
- Sahifa o'zgarsa — brauzerda (Playwright, Chromium `/opt/pw-browsers/chromium`)
  light/dark va mobil rejimda tekshiriladi
- Commit xabarlari o'zbekcha, nima o'zgargani va nima uchun tushuntiriladi
