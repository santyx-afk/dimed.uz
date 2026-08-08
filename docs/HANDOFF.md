# Dimed.uz — loyiha holati va davom ettirish uchun qo'llanma

> Bu hujjat yangi seansda ishni davom ettirish uchun. Oxirgi yangilanish:
> 2-hafta yakunlangan holat.

## Loyiha nima

Chinoz shahridagi **Dimed** ko'p ixtisosli tibbiy markazi uchun yangi sayt:
onlayn navbat, Telegram orqali kirish, bemor va shifokor shaxsiy kabinetlari,
1C laboratoriya tizimidan avtomatik tahlil natijalari.

Eski sayt — Jekyll'da edi, u `legacy/` papkasiga arxivlangan (o'chirilmagan:
tahlillar va narxlar shu yerdan olinadi, deploy qilinmaydi).

**Stack:** Astro 5 + Tailwind 4 + TypeScript · Netlify Functions ·
Amazon DynamoDB + S3 · Telegram Bot API · RHMT (hali ulanmagan)

**Repo:** `santyx-afk/dimed.uz`, branch `claude/dimed-clinic-website-plan-r6sdad`

---

## ⚠️ Birinchi navbatda: push muammosi

Ikkala haftaning ishi **lokal commit qilingan, lekin GitHub'ga push qilinmagan**:

```
5c5f93a  2-hafta: navbat API, to'lov, bemor va shifokor kabinetlari
9bca210  1-hafta: Astro + Tailwind skeleti, Telegram auth va 1C integratsiyasi
```

Sabab — GitHub yozish huquqi yo'q edi. Ikkita alohida xato kuzatilgan:

| Qatlam | Xato |
| --- | --- |
| git CLI (push) | `GitHub access is not enabled for this session. An org admin must connect the Claude GitHub App` |
| GitHub MCP | `403 Resource not accessible by integration` |

O'qish (fetch, branch ro'yxati) ishlagan — faqat yozish yopiq bo'lgan.

**Yangi seansda birinchi qadam:** `git push -u origin claude/dimed-clinic-website-plan-r6sdad`
sinab ko'rish. Ishlasa — davom etamiz, PR ochamiz. Ishlamasa:

1. [github.com/settings/installations](https://github.com/settings/installations) →
   **Claude** ilovasi → `dimed.uz` repository access ro'yxatida bormi;
   **Contents: Read and write** ruxsati bormi; yuqorida tasdiqlanmagan
   «Review request» banneri yo'qmi.
2. Yoki commitlar `dimed-1va2-hafta.bundle` faylida (foydalanuvchida bor) —
   uni lokal repo'da qo'llab, o'zi push qilishi mumkin.

Agar kod umuman yo'qolgan bo'lsa (yangi konteyner, bo'sh repo) — bundle'ni
foydalanuvchidan so'rang:
```bash
git fetch dimed-1va2-hafta.bundle \
  claude/dimed-clinic-website-plan-r6sdad:claude/dimed-clinic-website-plan-r6sdad
```

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
- **Bekor qilish yo'q.** Faqat boshqa vaqtga ko'chirish mumkin.
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

### 3-hafta ⏳ (qolgan ish)
Rejadagi bandlar:
1. **Eslatmalar** — Netlify Scheduled Functions (cron): qabulga 1 soat
   qolganda bemorga avtomatik xabar; ertalab shifokorga «bugungi navbatlaringiz»
2. **Reschedule** — `POST /api/reschedule` (1 soat qoidasi bilan) va bemor
   kabinetida «Vaqtni ko'chirish» tugmasi
3. **«Shifokor ishga chiqolmadi»** — shifokor kabinetidagi tugma: kunning
   barcha bemorlariga bot orqali xabar + ko'chirish taklifi
4. **Beta-test** — 1 bo'lim (taklif: Pediatriya) real rejimda
5. **Production deploy** — barcha 6 bo'lim, dimed.uz domenini Netlify'ga

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
scripts/        create-tables, seed-doctors, build-analyses,
                fake-dynamo (testlar uchun), test-*.mjs
legacy/         eski Jekyll sayti (kontent manbasi, deploy qilinmaydi)
```

### Buyruqlar
```bash
npm run dev          # lokal server
npm run build        # dist/ ga yig'ish
npm run typecheck    # astro check + tsc
npm test             # 61 mantiq + 24 API testi
npm run create-tables
npm run seed-doctors
```

### Testlar haqida
Testlar **haqiqiy AWS'siz** ishlaydi: `scripts/fake-dynamo.mjs` xotirada
DynamoDB o'rnini bosadi (PutItem, GetItem, UpdateItem, Query va
ConditionExpression'larni tushunadi), Telegram chaqiruvlari `globalThis.fetch`
orqali ushlab qolinadi. `scripts/test-api.mjs` butun oqimni sinaydi:
bot → OTP → sessiya → bron → kabinet → shifokor jadvali.

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
| `schedules` | `doctor_id` / `date` | kunlik alohida jadval, `day_off` |
| `appointments` | `doctor_day` / `time` | `doctor_day` = `"<doctor_id>#<sana>"`, GSI: `patient-index` (`phone`/`starts_at`) |
| `payments` | `payment_id` | |
| `lab_results` | `phone` / `sort_key` | `sort_key` = `"<sana>#<kod>"`, PDF S3'da |

**Bron holatlari:** `hold` (5 daqiqa, onlayn to'lov uchun) → `paid`;
`booked` (klinikada to'lash — darhol kuchga kiradi); `moved`, `cancelled`.
`lib/appointments.ts:takenTimes()` muddati o'tgan hold'ni bo'sh deb hisoblaydi —
DynamoDB TTL kechikishiga tayanilmaydi.

---

## Muhim qarorlar va tuzoqlar

1. **To'lov hozircha «klinikada to'lash» rejimida.** RHMT kalitlari yo'q edi,
   shuning uchun rejadagi B varianti ishlayapti: slot band qilinadi, to'lov
   qabulxonada. `lib/payment.ts` — adapter. Kalitlar kelganda o'sha fayldagi
   `createPayment` to'ldiriladi va `RHMT_ENABLED=1` qilinadi; bron mantig'i
   o'zgarmaydi.

2. **`define:vars` bo'lgan `<script>` inline bo'ladi** va DOM to'liq
   yuklanishidan oldin ishga tushadi. Shuning uchun BookingWidget'dagi
   «Navbat olish» tugmalari **event delegatsiya** orqali ushlanadi.

3. **Astro scoped CSS bola komponentga o'tmaydi.** `Logo.astro` ga `class`
   berish ishlamagan (o'lcham qo'llanmagan) — endi `height` prop orqali
   atributda beriladi.

4. **`<template>` ichidagi tugunlar `document.querySelectorAll` bilan
   topilmaydi** — faqat `template.content` orqali.

5. **`/api/slots` keshlanmaydi** (`no-store`). Avval 20 soniya keshlangan edi:
   bron qilgan bemor orqaga qaytsa o'z slotini yana bo'sh ko'rib 409 olardi.

6. **Vidjetdagi kun tugmalari** statik `doctors.ts` dagi `workdays` dan
   quriladi, slotlar esa bazadan keladi. Agar shifokor kunini o'zgartirsa,
   tugma faol ko'rinib, slot qaytmasligi mumkin — vidjet buni chiroyli hal
   qiladi (keyingi ish kuniga o'tadi), lekin 3-haftada API'dan `workdays`
   qaytarish yaxshiroq bo'lardi.

---

## Foydalanuvchidan kutilayotgan narsalar (0-bosqich)

Bularsiz 3-hafta to'liq yakunlanmaydi:

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
`DIMED_TABLE_PREFIX`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`LAB_S3_BUCKET`, `LC_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, `RHMT_ENABLED`

To'liq izohlar bilan — `.env.example`.

---

## Ish uslubi (shu loyihada kelishilgan)

- Muloqot va kod izohlari — **o'zbek tilida**
- Har bir o'zgarishdan keyin: `npm run typecheck && npm test && npm run build`
- Yangi mantiq yozilsa — unga test ham yoziladi (`scripts/test-*.mjs`)
- Sahifa o'zgarsa — brauzerda (Playwright, Chromium `/opt/pw-browsers/chromium`)
  light/dark va mobil rejimda tekshiriladi
- Commit xabarlari o'zbekcha, nima o'zgargani va nima uchun tushuntiriladi
