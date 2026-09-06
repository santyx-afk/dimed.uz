# Ochilish rejasi — to'rt qadam

> **Kim uchun:** klinika egasiga.
> **Sana:** 2026-09-07.
>
> Kod tomoni tayyor (270 ta tekshiruv yashil), AWS sozlangan. Qolgan
> to'rt narsa — sizning tomoningizda. Tartib muhim: **1-qadamsiz
> qolganlarining ma'nosi yo'q**, chunki hozir saytda eski nusxa turibdi.
>
> Boshqa hujjatlar: `LOYIHA-XARITASI.md` — kod qayerda nima qiladi;
> `1c-sync.md` — 1C dasturchisi uchun; `QOLGAN-ISHLAR.md` — umumiy ro'yxat.

## Qisqacha

| # | Qadam | Kim | Vaqt | Bo'lmasa nima bo'ladi |
| --- | --- | --- | --- | --- |
| 1 | Deploy'ni tuzatish | siz | 20 daq | **Sayt umuman ishlamaydi** |
| 2 | 1C konfiguratsiyasi | 1C dasturchisi | 1–2 soat | Navbat 1C ga tushmaydi, davomat yo'q |
| 3 | Shifokorlarni Telegram'ga bog'lash | siz | 30 daq | 7 shifokor kabinetiga kira olmaydi |
| 4 | Yosh cheklovi va sozlamalar | siz | 20 daq | Pediatrga kattalar yozilib qoladi |

---

# 1-qadam. Deploy — eng muhimi

## Muammo nima

`dimed.uz` da **eski nusxa** turibdi. Men tekshirdim:

```
dimed.uz/sitemap.xml   →  atigi 2 ta manzil: / va /tahlillar
dimed.uz/natija/       →  404   (tahlil natijasi sahifasi yo'q)
dimed.uz/ru/           →  404   (rus va ingliz tili yo'q)
dimed.uz/api/session   →  404   (API ulanmagan)
dimed.uz/.netlify/functions/doctors  →  502
```

Hozirgi kod esa **22 ta sahifa** yasaydi. Ya'ni saytda bron, kirish,
kabinet, tahlil natijasi — hech biri ishlamayapti.

Sarlavhalarda `x-nf-request-id` va `cache-status: "Netlify Edge"` bor —
demak Netlify chindan ham manba (oldida Cloudflare turibdi). Lekin
`Content-Security-Policy` sarlavhasi yo'q, qolgan uchtasi
(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) bor.
Bu `netlify.toml` ning **eski nusxasi** deployda ekanini ko'rsatadi.

## Sabab uchta bo'lishi mumkin

Netlify panelini ochib, tartib bilan tekshiring.

### 1.1. Domen boshqa saytga ulangan (eng ehtimolli)

Netlify hisobingizda **bir nechta sayt** bo'lishi mumkin — masalan eski
Jekyll sayti va yangi Astro loyihasi. `dimed.uz` eskisiga qarab turgan
bo'lsa, master'ga qancha push qilsangiz ham hech narsa o'zgarmaydi.

1. Netlify → **Sites** ro'yxatini oching
2. Har birida **Domain management** ni ko'ring — `dimed.uz` qaysinisida?
3. O'sha saytda **Site configuration → Build & deploy → Repository** —
   qaysi repo va qaysi branch ulangan?

**Kutilgan:** repo — dimed.uz loyihasi, branch — `master`,
build command — `npm run build`, publish directory — `dist`.

Domen noto'g'ri saytda bo'lsa: eskisidan domenni olib tashlab, to'g'ri
saytga qo'shing (Domain management → Add custom domain).

### 1.2. Deploy xato bilan tugayapti

Netlify build yiqilsa **eski nusxani qoldiradi** va sayt ishlayotgandek
ko'rinaveradi.

1. Netlify → sayt → **Deploys**
2. Oxirgi deploy sanasi va holatiga qarang

**Agar «Failed» bo'lsa:** log'ni oching, xato matnini menga yuboring.

**Agar oxirgi muvaffaqiyatli deploy bir necha oy oldin bo'lsa:** demak
avtomatik deploy ishlamayapti — **Build hooks** yoki **Stop builds**
sozlamasi o'chirilgan bo'lishi mumkin (Site configuration → Build &
deploy → **Builds** → «Stopped» holatda emasligini tekshiring).

### 1.3. Cloudflare eski nusxani keshlab turgan

Ehtimoli kam (`cf-cache-status: DYNAMIC` — keshlanmayapti), lekin
tekshirish oson: Cloudflare → **Caching → Configuration → Purge
Everything**.

## Muhit o'zgaruvchilari — deploy tuzalgach shart

Netlify → Site configuration → **Environment variables**. Quyidagilar
bo'lmasa sayt build bo'ladi, lekin API ishlamaydi:

| O'zgaruvchi | Qiymat | Izoh |
| --- | --- | --- |
| `DIMED_AWS_REGION` | `us-east-1` | Jadvallar shu regionda |
| `DIMED_AWS_ACCESS_KEY_ID` | AWS kalit | **`AWS_` prefiksi bilan qo'shib bo'lmaydi** — Netlify u nomlarni band qilgan |
| `DIMED_AWS_SECRET_ACCESS_KEY` | AWS maxfiy kalit | |
| `SESSION_SECRET` | kamida 32 belgi | `openssl rand -base64 32` |
| `TELEGRAM_BOT_TOKEN` | @BotFather dan | Kirish va xabarlar shunga tayanadi |
| `TELEGRAM_WEBHOOK_SECRET` | tasodifiy satr | Webhook'ni himoyalaydi |
| `ADMIN_TELEGRAM_IDS` | sizning Telegram ID | Vergul bilan bir nechta bo'lishi mumkin |
| `LC_API_KEY` | tasodifiy satr | 1C eski API yo'li uchun |
| `SITE_URL` | `https://dimed.uz` | Bot xabarlaridagi havolalar uchun |
| `TELEGRAM_LOG_BOT_TOKEN` | log-bot tokeni | Xatolar shu botga tushadi |
| `TELEGRAM_LOG_CHAT_ID` | guruh id (`-100…`) | |

Har biri uchun **Scopes** ro'yxatida **Functions** belgilangan bo'lishi
shart — aks holda funksiyalar ularni ko'rmaydi.

> ⚠️ **Kalitni almashtiring.** AWS kaliti menga chatda ochiq yuborilgan
> edi. Yangisini yarating va faqat ikki joyga qo'ying: shu ro'yxat va
> 1C konstantalari.

O'zgaruvchini qo'shgandan keyin **Trigger deploy → Clear cache and deploy
site** qiling — aks holda eski qiymatlar bilan qoladi.

## Telegram webhook

Deploy tuzalgach botni saytga ulash kerak (bir marta):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://dimed.uz/api/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Javobda `{"ok":true}` kelishi kerak.

## Qanday tekshirasiz

Deploy tugagach quyidagilar **hammasi** ishlashi kerak:

```
https://dimed.uz/sitemap.xml   →  6 ta manzil (uz, ru, en × 2 sahifa)
https://dimed.uz/natija        →  200 (sahifa ochiladi)
https://dimed.uz/ru/           →  200 (ruscha bosh sahifa)
https://dimed.uz/api/session   →  {"role":"guest"} kabi JSON
https://dimed.uz/api/doctors   →  shifokorlar ro'yxati JSON
```

Brauzerda: bosh sahifa → **Navbat olish** → Telegram orqali kirish →
bron qilish. Oxirigacha o'tsa — 1-qadam tugadi.

---

# 2-qadam. 1C konfiguratsiyasi

Bu qadamni **1C dasturchingiz** bajaradi. Unga yuboradigan to'liq
texnik hujjat alohida tayyorlangan — havolasini bering, `MH3` papkasini
ham yuboring.

Qisqacha nima bo'ladi:

1. `MH3` konfiguratsiyasi Konfiguratorda yuklanadi, **sintaksis
   nazoratidan** o'tkaziladi va ish bazasiga **birlashtiriladi**
   («Загрузить конфигурацию из файлов» **emas** — «Сравнить, объединить»)
2. Uchta konstanta to'ldiriladi:
   - `DynamoVisitsTable` = `dimed_visits`
   - `DynamoAppointmentsTable` = `dimed_appointments`
   - `DynamoBookingImportEnabled` = ✓
3. Har shifokorda yangi **«Saytdagi shifokor kodi»** (`WebDoctorID`)
   maydoni to'ldiriladi: `ashurov`, `narimbetov` va hokazo
   (to'liq ro'yxat — 3-qadamda)
4. AWS IAM da 1C kalitiga qo'shiladi:
   - `dynamodb:PutItem` → `table/dimed_visits`
   - `dynamodb:Query` → `table/dimed_appointments` va uning
     `index/date-index` i

Shundan keyin uchta narsa ishlaydi:

- **Saytdagi navbat 1C da paydo bo'ladi** — «Doktorga Qabul» hujjati
  o'tkazilmagan holda
- **Bemor kelgani belgilanadi** — registrator hujjatni o'tkazsa, saytda
  «qabul bo'ldi» yoziladi; kun oxirigacha o'tkazilmasa «kelmadi»
- **«Generate → Sotuv»** tugmasi va chekda navbat raqami o'rniga
  **«QABUL VAQTI»**

> **Diqqat:** 1C kodi 1C platformasida kompilyatsiya qilinmagan — bu
> yerda platforma yo'q edi. XML strukturasi, UUID'lar va modul
> muvozanati dastur bilan tekshirildi, lekin **sintaksis nazorati
> Konfiguratorda o'tishi shart**. Xato chiqsa matnini yuboring.

## Qanday tekshirasiz

1. Saytdan sinov navbat oling
2. 5–10 daqiqada 1C da **Ro'yxatga olish → Shifokor → Doktorga Qabul**
   ro'yxatida paydo bo'ladi, «Saytdagi navbat kaliti» ustuni to'lgan
3. Hujjatni **Провести** qiling
4. 10 daqiqada `dimed.uz/kabinet/admin/navbatlar` da «qabul bo'ldi»
   yoziladi

---

# 3-qadam. Shifokorlarni Telegram'ga bog'lash

## Hozirgi holat

Bazada 9 shifokor bor, **2 tasi** bog'langan:

| Shifokor kodi | Telegram | Faol | Narx |
| --- | --- | --- | --- |
| `ashurov` | ✅ bog'langan | ha | 90 000 |
| `narimbetov` | ✅ bog'langan | ha | 70 000 |
| `rahimov` | ❌ yo'q | ha | 70 000 |
| `mansurov` | ❌ yo'q | ha | 70 000 |
| `qobilxojayev` | ❌ yo'q | ha | 70 000 |
| `abdullayev` | ❌ yo'q | ha | 80 000 |
| `ilxomov` | ❌ yo'q | ha | 90 000 |
| `umatqulov` | ❌ yo'q | ha | 90 000 |
| `murtazayeva` | ❌ yo'q | **yo'q** (ginekologiya yopiq) | 90 000 |

Bog'lanmagan shifokor `/kabinet/shifokor` ga kira olmaydi: o'z
navbatlarini ko'rmaydi, «Qabul qilindi» deb belgilay olmaydi, ertalabki
xulosa xabari ham bormaydi.

## Tartib

**Har bir shifokor uchun ikki qadam:**

### 3.1. Shifokor botga kiradi

Shifokor o'z telefonidan botni ochadi, `/start` bosadi va **kontaktini
ulashadi**. Shundan keyin uning `telegram_id` si bazada paydo bo'ladi.

Bu qadamsiz bog'lash ishlamaydi — sayt shifokorning Telegram hisobini
boshqa yo'l bilan bila olmaydi.

### 3.2. Siz bog'laysiz

Loyiha papkasida (kalitlar muhitda bo'lishi kerak):

```bash
# Avval hozirgi holatni ko'rish
node scripts/link-doctor.mjs

# Telefon bo'yicha bog'lash (afzal)
node scripts/link-doctor.mjs rahimov --phone +998901234567

# Yoki to'g'ridan-to'g'ri Telegram id bo'yicha
node scripts/link-doctor.mjs rahimov --telegram 123456789
```

Argumentsiz ishga tushirilsa — barcha shifokorlar va ularning
bog'lanish holati ko'rinadi.

Windows PowerShell'da kalitlarni shunday berasiz:

```powershell
$env:DIMED_AWS_REGION="us-east-1"
$env:DIMED_AWS_ACCESS_KEY_ID="..."
$env:DIMED_AWS_SECRET_ACCESS_KEY="..."
node scripts/link-doctor.mjs
```

## Qanday tekshirasiz

`node scripts/link-doctor.mjs` — 8 ta faol shifokorning hammasida
`telegram_id` ko'rinishi kerak. So'ng bitta shifokor telefonidan
`dimed.uz/kabinet/shifokor` ochilsa — bugungi navbatlari chiqadi.

> **Eslatma:** `murtazayeva` faolsiz (ginekologiya bo'limi yopiq).
> Yangi shifokor kelganda admin paneldan yoqasiz — o'shanda bog'laysiz.

---

# 4-qadam. Yosh cheklovi va qolgan sozlamalar

## 4.1. Yosh cheklovi — hozir hammasi «cheklovsiz»

9 shifokorning **hech birida** yosh cheklovi qo'yilmagan. Ya'ni
pediatrga kattalar, kattalar shifokoriga bolalar yozilib qolishi mumkin.

1. `dimed.uz/kabinet/admin` ni oching
2. Har shifokorni bosing → **Yosh** bo'limidan tanlang:
   - **Hamma yosh** — cheklovsiz (terapevt, laborant)
   - **16 dan katta** — kattalar shifokori
   - **16 gacha** — pediatr
3. Saqlang

**Qanday tekshirasiz:** bosh sahifadagi shifokor kartasida yosh belgisi
paydo bo'ladi (masalan «16+»). Bron vidjetida yoshi mos kelmagan
bemorni tanlab bo'lmaydi.

## 4.2. Narxlarni ko'zdan kechirish

43 ta tahlil narxi bazaga yozildi — endi ularni admin paneldan
o'zgartira olasiz va sayt darhol yangilanadi.

- **Kabinet → Narxlar** — tahlil narxlari
- **Kabinet → Shifokorlar** — qabul narxlari (yuqoridagi jadvalda)

## 4.3. Shifokorlar jadvali

Bazada atigi **4 ta** kunlik jadval yozuvi bor. Har shifokor o'z
kabinetidan (`/kabinet/shifokor/jadval`) doimiy smenasini va slot
davomiyligini o'zi qo'yadi. Bog'langandan keyin (3-qadam) shuni
aytib qo'ying — jadvalsiz shifokorga bron ochilmaydi.

## 4.4. Admin huquqi

`ADMIN_TELEGRAM_IDS` da sizning Telegram ID'ingiz borligini tekshiring.
Bilmasangiz: `dimed.uz/kabinet/admin` ni oching — kirish rad etilsa,
ekranda o'z ID'ingiz yoziladi, uni Netlify sozlamalariga qo'shasiz.

## 4.5. Domen va Google

- **Google Search Console** (search.google.com/search-console):
  1. `dimed.uz` ni qo'shing
  2. **Sitemaps** ga `sitemap.xml` yuboring
  3. `https://dimed.uz/` ni URL Inspection dan «Request indexing»

Sayt uch tilda alohida manzilda: `/`, `/ru/`, `/en/`. Google buni
`hreflang` orqali biladi — sitemap'da hammasi ko'rsatilgan.

Bu 1-qadam tugagandan **keyin** qilinadi: hozir sitemap'da atigi 2 ta
manzil bor.

## 4.6. Payme (keyinroq)

Kod to'liq yozilgan, faqat kalitlar kerak. merchant.payme.uz da kassa
ochib, Netlify'ga `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYMENT_ENABLED=1`
qo'shasiz. Batafsil: `docs/payme-integration.md`.

Hozircha sayt **«qabulxona kassasida to'lash»** rejimida ishlaydi —
bu to'g'ri va xavfsiz boshlang'ich holat.

---

# Tugagach

Hammasi bajarilgach menga xabar bering — **to'liq sinov ro'yxatini**
tuzaman va har bir oqimni birga tekshiramiz: bron, kirish, kabinet,
shifokor kabineti, admin panel, bot xabarlari, tahlil natijasi, 1C
davomati.

## Tez ma'lumotnoma

| Buyruq | Nima qiladi |
| --- | --- |
| `node scripts/link-doctor.mjs` | Shifokorlar va bog'lanish holati |
| `npm run seed-prices` | Tahlil narxlarini bazaga yozadi |
| `npm run check-patients -- --phone "+998..."` | 1C shu raqamga nima yozganini ko'rsatadi |
| `npm test` | Barcha tekshiruvlar (270 ta) |
| `npm run build` | Saytni yig'ish |

| Manzil | Kim uchun |
| --- | --- |
| `/kabinet` | Bemor — navbatlari va tahlillari |
| `/kabinet/shifokor` | Shifokor — bugungi navbatlar va jadval |
| `/kabinet/admin` | Ega — shifokorlar (narx, davomiylik, yosh) |
| `/kabinet/admin/navbatlar` | Ega — butun klinika navbatlari va hisobot |
| `/kabinet/admin/narxlar` | Ega — tahlil narxlari |
| `/kabinet/admin/baholar` | Ega — bemor baholari |
