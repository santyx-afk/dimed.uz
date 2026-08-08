# Dimed.uz — ishga tushirish qo'llanmasi

Bu hujjat klinika egasi uchun: **kod tomondan nima qilindi**, **sizdan nima
kerak**, **har bir qadamdan keyin nima ishlay boshlaydi**.

Dasturchi uchun texnik hujjat alohida: `docs/HANDOFF.md`.

---

## 1. Bir qatorda: hozirgi holat

**Kod tayyor va tekshirilgan. Sayt hali internetda yo'q, chunki kalitlar
kiritilmagan.** Kalitlar kiritilgach — bir kun ichida ishga tushadi.

| | Holat |
| --- | --- |
| Sayt kodi (3 haftalik reja) | ✅ tugagan, `master` da |
| Avtomatik tekshiruv (CI) | ✅ har o'zgarishda ishlaydi |
| Testlar | ✅ 108 ta (64 mantiq + 44 API) o'tadi |
| Internetda ishlashi | ❌ kalitlar yo'q |
| Onlayn to'lov (RHMT) | ❌ RHMT hujjati yo'q |

---

## 2. Nima qilindi

### Bemor uchun

| Imkoniyat | Tafsilot |
| --- | --- |
| Onlayn navbat | Bo'lim → shifokor → sana → vaqt → tasdiq |
| Telegram orqali kirish | SMS yo'q, parol yo'q. Botga `/start`, kontakt ulashadi, 6 xonali kod oladi (5 daqiqa amal qiladi, bir martalik) |
| Shaxsiy kabinet | Navbatlari, tahlil natijalari, holati |
| Vaqtni ko'chirish | Boshqa vaqtga o'tkazadi. Bekor qilish yo'q — kelishuvga muvofiq |
| Eslatma | Qabuldan ~1 soat oldin botga xabar |
| Tahlil natijalari | 1C dan avtomatik keladi, PDF yuklab olinadi |

### Shifokor uchun

| Imkoniyat | Tafsilot |
| --- | --- |
| Shaxsiy kabinet | Bugungi va keyingi navbatlari |
| Jadvalni boshqarish | Smenalar (masalan 08:30–12:30 va 13:30–16:00), tanaffuslar, slot davomiyligi (10/15/20/30 daq) |
| Kunlik xulosa | Har kuni ertalab 07:00 da botga «bugungi navbatlaringiz» |
| «Ishga chiqa olmayman» | Bitta tugma: kun yopiladi, o'sha kundagi barcha bemorlarga uzr xabari boradi, slotlar bo'shaydi |

### Klinika uchun

- Xato loglari alohida Telegram guruhga tushadi — nosozlikni darhol bilasiz
- Bir slotga ikkita bemor yozila olmaydi (baza darajasida kafolatlangan)
- Qabulga kamida 1 soat qolgan bo'lishi shart — ham bron, ham ko'chirish uchun
- Barcha vaqt hisoblari Toshkent vaqtida (server dunyo vaqtida ishlasa ham)

### Texnik tomondan

- Eski Jekyll sayt → yangi Astro sayt (tezroq, kontent `legacy/` da saqlangan)
- 15 ta server funksiyasi, 7 ta baza jadvali
- Rasmlar 4 barobar siqilgan (423KB → 103KB), shriftlar o'z serverimizda
- SEO: `robots.txt`, `sitemap.xml`

---

## 3. Sizdan kerak — qadamma-qadam

> Kalitlarni menga yubormang. Ularni to'g'ridan-to'g'ri Netlify va AWS
> panelining o'ziga kiriting — shunda ular hech qayerda ortiqcha
> ko'chirilmaydi. Menga «qo'ydim» deb ayting, men tekshiraman.

### Qadam 1 — Telegram botlari · ~10 daqiqa · **siz**

1. Telegram'da **@BotFather** ni oching
2. `/newbot` → nom va username bering → **asosiy bot tokeni** chiqadi, saqlang
   - Bu bot bemorlar bilan ishlaydi: kirish kodi, eslatmalar, bekor qilish xabarlari
3. Yana `/newbot` → **log-bot** yarating → tokenini saqlang
   - Bu faqat sizga xatolar haqida yozadi, bemorlar ko'rmaydi
4. Telegram'da guruh yarating (masalan «Dimed — xatolar»), log-botni a'zo qiling
5. Guruhga biror xabar yozing, so'ng brauzerda oching:
   `https://api.telegram.org/bot<LOG_TOKEN>/getUpdates`
   Javobdagi `"chat":{"id":-100...}` — o'sha manfiy raqam kerak

**Natijada 3 ta qiymat:** asosiy bot tokeni, log-bot tokeni, guruh id.

### Qadam 2 — AWS · ~30 daqiqa · **siz** (bank kartasi kerak)

Bu yerda baza (navbatlar, bemorlar) va tahlil PDF fayllari saqlanadi.

1. https://aws.amazon.com da akkaunt oching
2. **Region tanlang va shuni hamma joyda ishlating** — tavsiya: `eu-central-1`
   (Frankfurt). Keyin o'zgartirish qiyin
3. IAM → foydalanuvchi yarating → unga ikki huquq bering:
   - DynamoDB: yozish/o'qish/qidirish (jadvallar va indekslar bo'yicha)
   - S3: fayl yuklash va o'qish
4. Shu foydalanuvchi uchun **Access Key** va **Secret Key** yarating
5. S3'da bucket yarating (masalan `dimed-lab`) — tahlil PDF'lari uchun

**Natijada 3 ta qiymat:** Access Key, Secret Key, bucket nomi.

### Qadam 3 — Netlify · ~15 daqiqa · **siz**

1. https://netlify.com da akkaunt oching (GitHub orqali kirsangiz qulay)
2. **Add new site → Import an existing project** → `santyx-afk/dimed.uz` ni tanlang
   - Build sozlamalari `netlify.toml` da yozilgan, qo'lda hech narsa kiritmaysiz
3. **Site settings → Environment variables** → 5-bo'limdagi jadval bo'yicha
   qiymatlarni kiriting
4. **Deploy** tugmasi

**Natijada:** sayt vaqtinchalik manzilda ochiladi (`...netlify.app`).

### Qadam 4 — Bazani yaratish · ~5 daqiqa · **men**

AWS kalitlari tayyor bo'lgach men ishga tushiraman:

```bash
npm run create-tables   # 7 ta jadval va indekslar
npm run seed-doctors    # shifokorlarni bazaga yozish
```

Natijani sizga ko'rsataman.

### Qadam 5 — Telegram webhook'ini ulash · ~2 daqiqa · **men**

Bu **deploy'dan keyin** qilinadi, chunki Telegram'ga saytning haqiqiy
manzili aytiladi:

```bash
curl -X POST "https://api.telegram.org/bot<ASOSIY_TOKEN>/setWebhook" \
  -d "url=https://<sayt-manzili>/api/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

**Shu qadamdan keyin bot javob bera boshlaydi.** Usiz botga yozsangiz
javob bo'lmaydi. Domen ulangach (Qadam 7) bu buyruq yangi manzil bilan
qayta yuritiladi.

### Qadam 6 — Uchdan-uchgacha sinov · ~30 daqiqa · **birgalikda**

Men tekshiraman, siz o'z telefoningizdan takrorlaysiz:

1. Botga `/start` → kontakt ulashish → kod keladimi
2. Saytga kod bilan kirish
3. Navbat olish → kabinetda ko'rinadimi
4. Vaqtni ko'chirish
5. Shifokor kabinetiga kirish (shifokor telegram id bo'yicha)
6. «Ishga chiqa olmayman» → bemorga xabar bordimi
7. Eslatma: qabulga 1 soat qolganda xabar keladimi
8. Xato loglari guruhga tushyaptimi

### Qadam 7 — Domen · ~1 kun (DNS tarqalishi) · **siz + men**

Beta muvaffaqiyatli bo'lgach: `dimed.uz` DNS yozuvlarini Netlify'ga
yo'naltirasiz, men saytda domenni tasdiqlayman. HTTPS sertifikati
avtomatik chiqadi.

---

## 4. Boshqalarga bog'liq — bugundan boshlang

Bular javob kutadi, shuning uchun yuqoridagi qadamlarga parallel yuritiladi.

| Kim | Nima berasiz | Nima olasiz | Nega bugun |
| --- | --- | --- | --- |
| **RHMT** | Merchant ariza | API kalitlari + **integratsiya hujjati** | Eng uzun kutish. Hujjatsiz to'lov kodi yozilmaydi |
| **1C dasturchisi** | `docs/1c-integration.md` + `LC_API_KEY` | Ular yozadigan yuborish moduli | Tahlil natijalari shunga bog'liq |
| **Shifokorlar** | Narx va jadval so'rovnomasi | Har biri uchun: qabul narxi, ish kunlari, smena vaqtlari, slot davomiyligi | Hozirgi qiymatlar taxminiy |

**RHMT haqida aniqlik:** kalitning o'zi yetarli emas — ularning texnik
hujjati kerak. Hujjat kelgach to'lov kodi yoziladi (`lib/payment.ts`),
`RHMT_ENABLED=1` qilinadi va **bron mantig'i umuman o'zgarmaydi**.
Hujjat kelmaguncha sayt «klinikada to'lash» rejimida to'liq ishlaydi.

---

## 5. Muhit o'zgaruvchilari — to'liq jadval

Netlify → Site settings → Environment variables.

| O'zgaruvchi | Qiymat qayerdan | Kim |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather, asosiy bot | siz |
| `TELEGRAM_WEBHOOK_SECRET` | Tasodifiy satr | men yarataman |
| `TELEGRAM_LOG_BOT_TOKEN` | @BotFather, log-bot | siz |
| `TELEGRAM_LOG_CHAT_ID` | Guruh id (manfiy raqam) | siz |
| `SESSION_SECRET` | Tasodifiy satr, ≥32 belgi | men yarataman |
| `DIMED_AWS_REGION` | `eu-central-1` | tayyor |
| `DIMED_TABLE_PREFIX` | `dimed` | tayyor |
| `AWS_ACCESS_KEY_ID` | AWS IAM | siz |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM | siz |
| `LAB_S3_BUCKET` | S3 bucket nomi | siz |
| `LC_API_KEY` | Tasodifiy satr → 1C ga beriladi | men yarataman |
| `PAYMENT_WEBHOOK_SECRET` | Tasodifiy satr | men yarataman |
| `RHMT_ENABLED` | Hozircha bo'sh qoldiriladi | keyin |

«Men yarataman» deganlari — tasodifiy parollar, ularni hech kimdan
so'ramaysiz. Kerak bo'lsa o'zingiz ham yaratasiz: `openssl rand -base64 32`.

---

## 6. Nima qilgandan keyin nima ishlaydi

Bu eng muhim jadval — har bir kalit nimani ochishini ko'rsatadi.

| Nima kiritilsa | Nima ishlay boshlaydi | Nima hali ishlamaydi |
| --- | --- | --- |
| **Hech narsa** (hozir) | Hech narsa — sayt internetda yo'q | Hammasi |
| **Netlify** (kalitsiz) | Sayt ochiladi, sahifalar ko'rinadi, narxlar va shifokorlar ro'yxati | Navbat, kirish — baza yo'q |
| **+ AWS** | Baza ishlaydi, slotlar ko'rinadi, navbat yoziladi | Kirish — kod yuboradigan bot yo'q |
| **+ Telegram (asosiy bot)** | **Sayt to'liq ishlaydi:** kirish, navbat, kabinet, ko'chirish, eslatmalar, shifokor kabineti | Xatolarni bilmaysiz; to'lov qabulxonada; tahlil natijalari yo'q |
| **+ log-bot** | Har qanday nosozlik guruhga tushadi | — |
| **+ 1C moduli** | Tahlil natijalari kabinetga avtomatik keladi | — |
| **+ RHMT hujjati va kalitlari** | Onlayn to'lov | — |
| **+ domen** | `dimed.uz` da ochiladi | — |

**Diqqat:** «Sayt to'liq ishlaydi» qatoriga yetish uchun uchtasi kerak:
**Netlify + AWS + Telegram asosiy bot**. Qolganlari — yaxshilanish,
ular kutsa ham sayt ishlaydi.

---

## 7. Beta-test rejasi

Butun klinikani birdan ochish shart emas.

**Taklif: Pediatriya bo'limi, 1 hafta.**

- Faqat 2 pediatr saytda ko'rinadi, qolgan bo'limlar vaqtincha yopiq
- Qabulxona parallel ravishda eski usulda ham yozib boradi (xavfsizlik uchun)
- Har kuni tekshiriladi: navbatlar to'g'ri tushdimi, eslatmalar bordimi,
  log guruhda xato bormi

**Nimani kuzatamiz:** bemorlar Telegram orqali kirishni tushundimi,
shifokor jadvalini o'zi boshqara oldimi, ikki tizim (sayt va qog'oz)
mos keldimi.

**Bir hafta muammosiz o'tsa** — qolgan 5 bo'lim ochiladi va qabulxona
parallel yozishni to'xtatadi.

---

## 8. Ma'lum cheklovlar — oldindan biling

1. **To'lov hozircha qabulxonada.** Slot band qilinadi, pul klinikada
   to'lanadi. RHMT hujjati kelgach onlayn to'lov qo'shiladi
2. **Bekor qilish yo'q.** Bemor faqat vaqtni ko'chira oladi. Shifokorni
   almashtirish — bu yangi navbat. Bu kelishilgan qoida
3. **1 soat qoidasi.** Qabulga 1 soatdan kam qolgan bo'lsa bron ham,
   ko'chirish ham mumkin emas
4. **Kirish faqat Telegram orqali.** Telegram'i yo'q bemor saytdan
   yozila olmaydi — u qabulxonaga qo'ng'iroq qiladi
5. **Agar AWS jadvallari ilgari yaratilgan bo'lsa**, `date-index`
   indeksini qo'lda qo'shish kerak — usiz eslatmalar ishlamaydi.
   Noldan yaratilsa bu muammo yo'q

---

## 9. Xulosa: kim nima qiladi

**Siz — bugun:**
- [ ] RHMT ga ariza (hujjat ham so'rang)
- [ ] 1C dasturchisiga `docs/1c-integration.md` ni yuboring
- [ ] Shifokorlardan narx va jadval so'rang

**Siz — shu hafta:**
- [ ] Telegram: 2 ta bot + log guruh (10 daq)
- [ ] AWS: akkaunt, IAM kalitlari, S3 bucket (30 daq)
- [ ] Netlify: repo ulash, kalitlarni kiritish (15 daq)

**Men — siz tugatgandan keyin, bir kun ichida:**
- [ ] Jadvallarni yaratish, shifokorlarni yozish
- [ ] Telegram webhook'ini ulash
- [ ] Uchdan-uchgacha sinov va hisobot
- [ ] Pediatriya bo'limini beta rejimga tayyorlash

**Men — hujjat kelgach:**
- [ ] RHMT onlayn to'lovi

---

*Savol tug'ilsa yoki biror qadamda to'xtab qolsangiz — qaysi qadam
ekanini ayting, o'sha joyidan davom ettiramiz.*
