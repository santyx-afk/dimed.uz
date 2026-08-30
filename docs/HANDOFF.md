# Dimed.uz — loyiha holati va davom ettirish uchun qo'llanma (handoff)

> Bu hujjat yangi seansda (yoki yangi odam) ishni davom ettirishi uchun.
> Oxirgi yangilanish: **2026-08-30**. Sayt **jonli**: baza sozlangan,
> @dimedcbot ishlayapti, CI yashil (97 mantiq + 72 API testi,
> typecheck 0 xato). Qolgan ishlar — «Hozirgi holat» bo'limida.

## Loyiha nima

Chinoz shahridagi **Dimed** ko'p ixtisosli tibbiy markazi uchun yangi sayt:
onlayn navbat, Telegram orqali kirish, bemor va shifokor shaxsiy kabinetlari,
1C laboratoriya tizimidan avtomatik tahlil natijalari.

Eski sayt — Jekyll'da edi, u `legacy/` papkasiga arxivlangan (o'chirilmagan:
tahlillar va narxlar shu yerdan olinadi, deploy qilinmaydi).

**Stack:** Astro 5 + Tailwind 4 + TypeScript · Netlify Functions ·
Amazon DynamoDB (us-east-1, jadval prefiksi `dimed_`) · Telegram Bot API ·
Payme (kod tayyor, kassa kutilmoqda)

**Repo:** `santyx-afk/dimed.uz`, asosiy branch — `master`.
**Bot:** @dimedcbot (saytda «Dimed klinikasi boti» deb ko'rinadi).
**Admin panel:** `/kabinet/admin` (kirish `ADMIN_TELEGRAM_IDS` bo'yicha).

---

## Hozirgi holat (2026-08-28)

Jonli va tekshirilgan: baza (9 jadval, TTL yoqilgan), 9 shifokor yuklangan,
webhook ulangan (kod kelyapti), admin panel ochilgan, QA aylanishi o'tkazilib
topilgan kamchiliklar tuzatilgan, test ma'lumotlar bazadan tozalangan.

### Klinika egasi zimmasida

- [ ] **AWS kalitini almashtirish — eng muhim!** Joriy kalit chatda oshkor
      bo'lgan. Tartib: IAM'da yangi kalit yaratish → Netlify'da
      `DIMED_AWS_ACCESS_KEY_ID` / `DIMED_AWS_SECRET_ACCESS_KEY` ni yangilash →
      **Trigger deploy** → eski kalitni IAM'da o'chirish.
- [ ] Murtazayevani `/kabinet/admin` da faollashtirish — Ginekologiya hozir
      bron qilinmaydi (0 shifokor).
- [ ] Payme kassa ID va kalitlar → `PAYME_MERCHANT_ID`, `PAYME_KEY`,
      `PAYME_ENABLED=1` (bron mantig'i o'zgarmaydi).
- [ ] Mobil (375px) ko'rinishni qo'lda bir aylanib chiqish.
- [ ] (istalganda, xavfsizlik) Telegram bot tokenini BotFather'da `/revoke`
      qilish → Netlify'da `TELEGRAM_BOT_TOKEN` → Trigger deploy →
      **setWebhook'ni qayta chaqirish** (secret bilan birga).

### 1C dasturchisi zimmasida (spetsifikatsiya: `docs/1c-integration.md`)

- Konstanta `DynamoDBAnalysisResultTable = dimed_analysis_results`
  (standart `AnalysisResult` **emas** — sayt IAM'i faqat `dimed_*` o'qiydi).
- Telefonsiz bemorlarni yubormaslik — ular `"+"` kaliti ostiga tushib qoladi.
- `dimed_individuals` dagi eski yozuvni yangi formatda qayta yuborish:
  endi `sort_key` = 1C bemor kodi (alohida `Code` maydoni kerak emas).
- Sana formatida `DF=yyyy-MM-dd` afzal (sayt `dd.MM.yyyy H:mm:ss` ni ham
  tushunadi, bir xonali soat bilan ham).
- **Yangi:** `Posted` va `DeletionMark` (BOOL) yuborish — bekor qilingan
  natija kabinetda qolib ketmasligi uchun; `dimed_individuals` ga ham
  `DeletionMark`. To'liq javob: `docs/1c-integration.md` → «Sayt
  tomonining javobi».

### Keyingi seans uchun (so'ralganda)

- Sinov bog'lamasini yechish: **+998998889808 Ashurovga test uchun ulangan**.
  Haqiqiy shifokorlar: `npm run link-doctor -- <id> --phone +998...`
  (argumentsiz — ro'yxat).
- Ega tasdiqlagach eski `dimed_test_table` va `AnalysisResult` jadvallarini
  o'chirish.
- G'oya: 1C yangi natija yozganda bemorga bot-xabar (cron orqali).
- `lc-results` (`LC_API_KEY`) — eski yo'l; 1C to'g'ridan-to'g'ri yozuvi
  barqaror ishlagach olib tashlash mumkin.

---

## Biznes-mantiq (kelishilgan qoidalar)

- **Autentifikatsiya faqat Telegram orqali.** SMS yo'q, parol yo'q. Bemor botga
  `/start` yuboradi, kontaktini ulashadi, 6 xonali OTP oladi (5 daqiqa amal
  qiladi, bir martalik), uni saytga kiritadi. Telefon allaqachon bog'langan
  bo'lsa `/start` darhol yangi kod yuboradi — kontakt qayta so'ralmaydi.
- **Smenalar va tanaffuslar.** Har bir shifokor kuniga bir nechta smena
  belgilaydi (masalan 08:00–12:00 va 13:00–17:00). Smenalar orasidagi
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
- **1C bazaga to'g'ridan-to'g'ri yozadi, sayt faqat o'qiydi** (quyida).

---

## Bajarilgan ishlar

### 1-hafta ✅
- Repo qayta tuzildi: Jekyll → `legacy/`, o'rniga Astro loyihasi
- Astro + Tailwind + TypeScript skeleti, Netlify sozlamalari
- Dizayn Astro komponentlariga ko'chirildi (bosh sahifa, tahlillar sahifasi)
- Shriftlar o'z serverimizda (woff2), shifokor rasmlari webp (423KB → 103KB)
- `telegram-webhook`, `auth-verify` (OTP + imzolangan HttpOnly sessiya)
- `lc-results` — 1C dan matn natijalar (PDF yo'q — brauzer o'zi yasaydi)
- Admin log-bot: har qanday xato Telegram guruhga
- `docs/1c-integration.md` — 1C dasturchisi uchun spetsifikatsiya

### 2-hafta ✅
- **Umumiy mantiq** (`netlify/functions/lib/`): `time.ts` (UTC+5),
  `slots.ts` (slot yasash, 1 soat qoidasi), `appointments.ts` (hold muddati),
  `schedule.ts` (smenalarni tekshirish), `payment.ts` (to'lov adapteri)
- **API:** `/api/slots`, `/api/book` (atomik), `/api/payment-webhook`,
  `/api/me`, `/api/doctor-schedule`, `/api/logout`,
  `/api/doctors` (public), `/api/admin-doctors` (admin CRUD)
- **Sahifalar:** `/kirish` (OTP), `/kabinet` (bemor), `/kabinet/shifokor`,
  `/kabinet/admin` (egaga — shifokorlarni boshqarish)
- Navbat vidjeti real API'ga ulandi, SEO: `robots.txt`, `sitemap.xml`

### 3-hafta ✅
- **`POST /api/reschedule`** — vaqtni ko'chirish. Avval yangi slot atomik
  egallanadi, keyin eskisi `moved` bo'ladi; ikkinchi qadam yiqilsa yangi
  yozuv qaytarib olinadi (bitta bemorda ikkita navbat qolmasin).
- **`POST /api/doctor-off`** — «bugun ishga chiqa olmayman»: kun yopiladi,
  navbatlar `cancelled_by_clinic`, bemorlarga bot orqali uzr xabari.
- **Eslatmalar (cron):** `remind-patients` (har 10 daqiqada, qabulga ~1 soat
  qolganda) va `doctor-daily` (Toshkentda 07:00, «bugungi navbatlaringiz»).
- `appointments` ga **`date-index` GSI**.

### 4-bosqich — ishga tushirish ✅ (2026-08-25…28)
- **Baza jonli sozlandi**: 9 jadval yaratildi, `otp_codes` TTL yoqildi,
  9 shifokor yuklandi. `scripts/cloudshell-setup.sh` DynamoDB Local'da
  E2E tekshirildi (idempotent, `telegram_id` bog'lanishlarni o'chirmaydi).
- **@dimedcbot webhook ulandi.** 401 bo'lsa log faqat ikki tomondagi secret
  **uzunligini** chiqaradi — sir oshkor bo'lmaydi, xato tomoni darhol ko'rinadi.
- **1C to'g'ridan-to'g'ri yozuv arxitekturasi**: 1C `dimed_individuals`
  (profil) va `dimed_analysis_results` (natijalar) ga o'zi yozadi. Sayt
  kontakt ulashishda va **har kirishda** profilni `dimed_users` ga
  birlashtiradi (`lib/patients.ts`, best-effort — xato kirishni to'smaydi).
  `/api/me` ikkala natija jadvalini o'qiydi, begona yozuvlarga chidamli:
  bitta jadval yiqilsa qolgani ko'rinadi, 1C adashib `dimed_lab_results`
  ga qo'ygan 1420 hujjat ham o'qiladi (tarix saqlanadi).
- **CSV import**: `scripts/import-patients.mjs` — 1C ro'yxatini telefon
  bo'yicha botdan o'tgan bemorlarga biriktiradi (`--dry` rejimi bor).
- **UX tuzatishlari**: OTP `<code>` da (bosilsa nusxalanadi), `/start`
  telefonni qayta so'ramaydi, ko'chirish kalendari o'zbekcha, natija PDF'i
  yashirin `iframe` + `print()` orqali (popup-blocker o'tkazib yuboradi),
  shifokor kabinetida 7 kunlik navigatsiya va **faqat band slotlar**,
  bosh sahifada shifokor soni jonli `/api/doctors` dan.
- **QA aylanishi** o'tkazildi, topilganlar tuzatildi, test bron/smenalar
  bazadan tozalandi.

### 5-bosqich — MedHisob (1C) hisobotiga moslash ✅ (2026-08-30)
1C dasturchisi konfiguratsiya bo'yicha to'liq hisobot berdi; unga ko'ra:
- natijalar **oxirigacha** o'qiladi (`queryAllPages`) — eski 50 talik
  chegara to'liq yuklashdan keyin tarixning katta qismini yashirardi;
- cron so'rovlari ham sahifalanadi (kunlik navbat ro'yxati);
- bir telefondagi oiladan Telegram egasi tanlanadi, natijalarda esa
  kimniki ekani yoziladi;
- 1C kodidagi guruh ajratkichi tozalanadi (`"10 482"` → `"10482"`);
- bo'sh analit nomi o'rniga xalqaro kod ko'rsatiladi;
- `Posted=false` / `DeletionMark=true` yozuvlar kabinetda ko'rinmaydi.

Javob va 1C tomonidan kutilayotgan uchta yangi maydon:
`docs/1c-integration.md` → «Sayt tomonining javobi».

---

## Kod tuzilishi

```
src/
  components/   Nav, Footer, Logo, DeptIcon, BookingWidget
  data/         doctors.ts, departments.ts, site.ts, analyses.json (43 ta tahlil)
  layouts/      Base.astro
  pages/        index, tahlillar, kirish, kabinet, kabinet/shifokor,
                kabinet/admin, robots.txt.ts, sitemap.xml.ts
  styles/       global.css (dizayn tokenlari), fonts.css
netlify/functions/
  lib/          db, env, http, session, telegram, time, slots, appointments,
                schedule, auth, payment, patients (1C profil birlashtirish)
  *.ts          har bir fayl — bitta /api/<nom> endpoint
  remind-patients.ts, doctor-daily.ts — cron (config.schedule)
scripts/        create-tables, seed-doctors, link-doctor, import-patients,
                build-analyses, cloudshell-setup.sh (+ gen-cloudshell-setup),
                fake-dynamo (testlar uchun), test-*.mjs
docs/           HANDOFF (shu fayl), 1c-integration, payme-integration,
                ISHGA-TUSHIRISH
legacy/         eski Jekyll sayti (kontent manbasi, deploy qilinmaydi)
```

### Buyruqlar
```bash
npm run dev          # lokal server
npm run build        # dist/ ga yig'ish
npm run typecheck    # astro check + tsc
npm test             # 97 mantiq + 72 API tekshiruvi (haqiqiy AWS'siz)
npm run create-tables
npm run seed-doctors
npm run link-doctor  # shifokorni Telegram'ga bog'lash (argumentsiz — ro'yxat)
npm run gen-cloudshell  # scripts/cloudshell-setup.sh ni qayta yaratish
node scripts/import-patients.mjs bemorlar.csv --dry  # 1C CSV import sinovi
```

### CloudShell skripti
`scripts/cloudshell-setup.sh` — `create-tables` + `seed-doctors` ning
AWS CLI'dagi ko'chirmasi. Sababi amaliy: klinika egasi CloudShell'ga
bitta faylni yuklaydi va `bash cloudshell-setup.sh` deydi — git,
Node.js, npm va kalit kerak emas.

Fayl **qo'lda tahrirlanmaydi**: u `tables.mjs` va `doctors.ts` dan
`npm run gen-cloudshell` orqali yaratiladi, `test-tables.mjs` esa
faylning manbaga mosligini tekshiradi. Shifokor narxi o'zgarib fayl
yangilanmasa, test qizil bo'ladi.

Maydon nomlari `#f0`, `#f1` kabi taxalluslar bilan yoziladi —
DynamoDB'ning band so'zlari ro'yxati uzun va kengayib turadi.

### Testlar haqida
Testlar **haqiqiy AWS'siz** ishlaydi: `scripts/fake-dynamo.mjs` xotirada
DynamoDB o'rnini bosadi (PutItem, GetItem, UpdateItem, Query va
ConditionExpression'larni tushunadi), Telegram chaqiruvlari `globalThis.fetch`
orqali ushlab qolinadi. `scripts/test-api.mjs` butun oqimni sinaydi:
bot → OTP → sessiya → bron → ko'chirish → eslatma → kunlik xulosa →
shifokor chiqmadi → admin panel → Payme.

**Sanalar Toshkent kalendari bo'yicha olinadi.** `BOOK_DATE` — bugundan
ikki kun keyin: eslatma testining «30 daqiqadan keyingi» yozuvi Toshkentda
yarim tunga yaqin ertangi kunga tushib, «shifokor chiqmadi» testi bilan
kesishardi. Avval sana UTC bo'yicha hisoblanardi va testlar sutkasiga
330 daqiqa yiqilardi.

**CI:** `.github/workflows/ci.yml` har PR va master'ga push'da
`typecheck → test → build` ni yurgizadi. Kalit kerak emas.

TypeScript fayllar testlarda `node --experimental-strip-types` bilan
to'g'ridan-to'g'ri import qilinadi — shuning uchun `lib/` ichidagi importlar
`.ts` kengaytmasi bilan yozilgan (`allowImportingTsExtensions: true`).

---

## DynamoDB sxemasi (jonli, prefiks `dimed_`, us-east-1)

| Jadval | PK / SK | Izoh |
| --- | --- | --- |
| `users` | `telegram_id` | **faqat sayt yozadi.** GSI: `phone-index`, `code-index` (1C kodi, sparse) |
| `otp_codes` | `phone` | TTL: `expires_at` (jonli bazada yoqilgan) |
| `individuals` | `phone` / `sort_key` | **1C yozadi.** `sort_key` = 1C bemor kodi. Maydonlar inglizcha: Surname, Name, Patronymic, IsMale, Birthday… |
| `doctors` | `doctor_id` | GSI: `telegram-index` (shifokor kabineti) |
| `schedules` | `doctor_id` / `date` | kunlik smenalar, `day_off`, `summary_sent_at` |
| `appointments` | `doctor_day` / `time` | `doctor_day` = `"<doctor_id>#<sana>"`; GSI: `patient-index` (`phone`/`starts_at`), `date-index` (`date`/`starts_at`) |
| `analysis_results` | `phone` / `sort_key` | **1C yozadi.** `sort_key` = hujjat UID, ichida `AnalysisResults` ro'yxati |
| `payments` | `payment_id` | |
| `lab_results` | `phone` / `sort_key` | sayt yozuvi (`"<sana>#<kod>"`); 1C adashib qo'ygan hujjatlar ham o'qiladi |

**Bron holatlari:** `hold` (5 daqiqa, onlayn to'lov uchun) → `paid`;
`booked` (klinikada to'lash — darhol kuchga kiradi); `done`; `moved`;
`cancelled`; `cancelled_by_clinic` (shifokor chiqmadi).

Holatlar bilan ishlash `lib/appointments.ts` da markazlashgan:
- `holdsSlot()` — yozuv slotni band qilib turibdimi (muddati o'tgan hold —
  yo'q; `moved` / `cancelled*` — yo'q). DynamoDB TTL kechikishiga tayanilmaydi.
- `isConfirmed()` — bron kuchdami (`paid` yoki `booked`). Eslatma, ko'chirish
  va kunlik xulosa faqat shularga tegishli.

Jonli bazada ikkita **meros jadval** ham bor: `dimed_test_table` va 1C
standart nomi bilan yaratilgan `AnalysisResult` — ega tasdiqlagach o'chiriladi.

---

## Muhim qarorlar va tuzoqlar

1. **To'lov hozircha «klinikada to'lash» rejimida.** Payme kassasi hali
   ochilmagan. Integratsiya kodi to'liq yozilgan: checkout havolasi
   (`lib/payment.ts`) va Payme Merchant API webhook'i (`payment-webhook.ts`,
   JSON-RPC: CheckPerform/Create/Perform/Cancel/Check/GetStatement).
   Kassa ochilgach `PAYME_MERCHANT_ID`, `PAYME_KEY` qo'yiladi va
   `PAYME_ENABLED=1` qilinadi; bron mantig'i o'zgarmaydi.
   To'liq spetsifikatsiya: `docs/payme-integration.md`.

2. **Shifokorning `telegram_id` si qo'lda bog'lanadi.** `seed-doctors` uni
   yozmaydi — aks holda har seed'da bog'lanish o'chib ketardi. Buning uchun
   `npm run link-doctor` bor (telefon yoki id bo'yicha, bitta akkaunt ikkita
   shifokorga biriktirilmaydi). Bu qadam unutilsa bemor tomoni ishlaydi,
   shifokor esa kabinetiga kira olmaydi.

3. **`define:vars` bo'lgan `<script>` inline bo'ladi** va DOM to'liq
   yuklanishidan oldin ishga tushadi. Shuning uchun BookingWidget'dagi
   «Navbat olish» tugmalari **event delegatsiya** orqali ushlanadi. Kabinet
   sahifasidagi ko'chirish tugmalari ham shunday — kartochkalar har safar
   `innerHTML` bilan qaytadan chiziladi.

4. **Astro scoped CSS bola komponentga o'tmaydi.** `Logo.astro` ga `class`
   berish ishlamagan — endi `height` prop orqali atributda beriladi.

5. **`<template>` ichidagi tugunlar `document.querySelectorAll` bilan
   topilmaydi** — faqat `template.content` orqali.

6. **`/api/slots` keshlanmaydi** (`no-store`). Avval 20 soniya keshlangan edi:
   bron qilgan bemor orqaga qaytsa o'z slotini yana bo'sh ko'rib 409 olardi.

7. **Vidjetdagi kun tugmalari serverdan tuzatiladi.** `/api/slots` har javobda
   `workdays` ni qaytaradi; statik `doctors.ts` faqat birinchi chizishga.

8. **Cron eslatmalari takror yubormaydi.** `remind-patients` avval yozuvni
   `reminded_at` bilan shartli belgilaydi, keyin xabar yuboradi. Kunlik
   xulosa `schedules.summary_sent_at` bilan xuddi shunday himoyalangan.
   Eslatma oynasi 70 daqiqa (60 emas): cron 10 daqiqada bir ishlaydi.

9. **`doctor-off` avval kunni yopadi, keyin navbatlarni bekor qiladi** —
   teskari tartibda bo'shagan slotni yangi bemor ilib ketishi mumkin edi.

10. **Admin panel — `/kabinet/admin`.** Kirish `ADMIN_TELEGRAM_IDS` bo'yicha
    (`isAdmin`, lib/auth.ts). 403 javobi joriy `telegramId` ni qaytaradi —
    egasi o'z ID sini bilib, env'ga qo'yishi uchun. Upsert **UpdateCommand
    SET** bilan — `telegram_id` bog'lanish o'chmaydi. «O'chirish» =
    `active:false` (navbatlar tarixi saqlanadi).

11. **Shifokor ro'yxati jonli.** `GET /api/doctors` faol shifokorlarni beradi;
    bron vidjeti, bosh sahifadagi shifokor soni va bo'lim hisoblagichlari
    shundan yangilanadi (statik ro'yxat — faqat birinchi chizish).

12. **1C bilan taqsimot qat'iy:** 1C faqat `dimed_individuals` va
    `dimed_analysis_results` ga yozadi; `dimed_users` — faqat sayt
    (`telegram_id` kalitini 1C bilmaydi ham). Sayt 1C jadvallarini faqat
    o'qiydi va har qanday shakldagi yozuvga chidamli bo'lishi shart:
    telefoni yo'q bemor `"+"` kaliti ostida, sana `"28.12.2024 9:30:24"`
    kabi bir xonali soat bilan, kod esa `"10 482"` ko'rinishida
    (1C `String(Son)` guruh ajratkichini qo'shadi) kelishi mumkin.

17. **DynamoDB javobni 1 MB da kesadi** — `Limit` so'ralmasa ham.
    Shuning uchun ko'p yozuv qaytarishi mumkin bo'lgan har bir so'rov
    `queryAllPages()` (lib/db.ts) orqali oxirigacha o'qiladi: bemor
    natijalari va cron'ning kunlik navbat ro'yxati. Soxta DynamoDB ham
    sahifalaydi (25 tadan), ya'ni sahifalashni unutgan kod testda
    ushlanadi. Natijalarni bitta sahifa bilan cheklab bo'lmaydi: 1C
    hujjatining sort kaliti — UUID, tartibi sanaga bog'liq emas.

18. **Bekor qilingan natija ko'rinmaydi.** 1C hujjatni bekor qilsa
    (`Posted=false`) yoki o'chirishga belgilasa (`DeletionMark=true`),
    sayt uni kabinetda ko'rsatmaydi. Maydon umuman bo'lmasa —
    ko'rsatiladi (eski yozuvlar ular yuborilmasdan oldin tushgan).
    Shu yo'l tanlangani uchun 1C'ga `DeleteItem` huquqi kerak emas.

19. **Bir telefon — bir oila.** Bemor profili birlashtirilayotganda
    Telegram bergan ism bilan solishtirib mos kelgan bemor tanlanadi
    (`telegram_name` — 1C hech qachon yozmaydigan yagona ism maydoni).
    Natijalar esa hammasi ko'rinadi, har birida `PatientName` bilan
    kimniki ekani yoziladi.

13. **Webhook secret qoidalari** (ikki marta kuydirgan!):
    faqat harf-raqam — brauzer URL'ni `#` da kesadi, Telegram maxsus
    belgini rad etadi; secret Netlify env'da va `setWebhook` da **aynan
    bir xil** bo'lishi shart; token yoki secret o'zgarsa `setWebhook`
    **qayta** chaqiriladi; «Webhook is already set» = parametrlar
    o'zgarmagan; brauzer tarixidagi eski setWebhook havolasini qayta
    ochish — eski secret'ni qaytarib qo'yadi. 401 diagnostikasi
    funktsiya logida: ikkala tomon secret'ining uzunligi.

14. **Netlify env o'zgarishi o'z-o'zidan kuchga kirmaydi** — har env
    o'zgarishidan keyin **Trigger deploy** kerak. Yana bir tuzoq:
    production deploy **Locked** bo'lishi mumkin (Deploys sahifasida) —
    o'shanda preview'lar yig'ilaveradi, sayt esa eski deploy'da qoladi
    (avgustda 3 ta PR shu sababdan ko'rinmay turgan).

15. **Natija PDF'i yashirin `iframe` (`srcdoc`) + `contentWindow.print()`
    bilan.** `window.open` + `noopener` `null` qaytaradi, popup-blocker esa
    oynani yutib yuborardi — iframe usuli hammasidan o'tadi.

16. **Bemor profili 1C dan birlashtiriladi** (`lib/patients.ts`,
    `mergeIndividualProfile`): kontakt ulashilganda va har OTP kirishda.
    Xatosi kirishni to'smaydi (catch → log-bot). Kontakt saqlash **Put emas
    Update** — 1C sinxronlagan maydonlar o'chib ketmasin.

---

## Muhit o'zgaruvchilari (Netlify)

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LOG_BOT_TOKEN`,
`TELEGRAM_LOG_CHAT_ID`, `ADMIN_TELEGRAM_IDS`, `SESSION_SECRET`,
`DIMED_AWS_REGION`, `DIMED_TABLE_PREFIX`, `DIMED_AWS_ACCESS_KEY_ID`,
`DIMED_AWS_SECRET_ACCESS_KEY`, `LC_API_KEY` (meros),
`PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST_KEY`, `PAYME_ENABLED`

To'liq izohlar bilan — `.env.example`. Har o'zgarishdan keyin —
**Trigger deploy** (14-tuzoq).

### Xavfsizlik qoidalari

- Kalit va token **qiymatlari** hech qachon repoga, hujjatga yoki commit'ga
  yozilmaydi — bu fayl ham faqat nomlarni aytadi.
- Chatga tushib qolgan kalit — oshkor bo'lgan kalit: darhol rotatsiya
  (yuqoridagi checklist'da tartibi bor).
- Lokal ishda kalitlar faqat vaqtinchalik faylda (chmod 600) turadi va
  ish tugashi bilan qaytarib bo'lmas o'chiriladi.

---

## Ish uslubi (shu loyihada kelishilgan)

- Muloqot va kod izohlari — **o'zbek tilida**; foydalanuvchiga javoblar
  qisqa va sodda («qisqa qisqa ayt»).
- Har bir o'zgarishdan keyin: `npm run typecheck && npm test && npm run build`
- Yangi mantiq yozilsa — unga test ham yoziladi (`scripts/test-*.mjs`)
- Sahifa o'zgarsa — brauzerda (Playwright, Chromium `/opt/pw-browsers/chromium`)
  light/dark va mobil rejimda tekshiriladi
- Commit xabarlari o'zbekcha, nima o'zgargani va nima uchun tushuntiriladi
- Ish `claude/dimed-github-push-lu8cfu` branch'ida boradi, PR ochiladi;
  ega «merge» desa — merge qilinadi.
