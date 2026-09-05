# 1C → dimed.uz: tahlil natijalarini yuborish

Bu hujjat 1C tomonidagi dasturchi uchun. Laboratoriya natijasi tayyor
bo'lganda 1C bitta HTTP so'rov yuboradi — natija bemorning shaxsiy
kabinetida darhol paydo bo'ladi va unga Telegram orqali xabar boradi.

## Endpoint

```
POST https://dimed.uz/api/lc-results
Content-Type: application/json
X-API-Key: <klinikaga berilgan kalit>
```

API kalitni saytni ishlab chiquvchi beradi. Kalit faqat 1C serverida
saqlanadi va hech qayerda ochiq ko'rsatilmaydi.

## So'rov tanasi

```json
{
  "phone": "+998901234567",
  "order_id": "4127",
  "date": "2026-08-05T09:32:00+05:00",
  "results": [
    {
      "code": "96",
      "title": "Gemoglobin",
      "value": "132 g/L",
      "reference": "120 – 160"
    },
    {
      "code": "19",
      "title": "Qon shakar (glyukoza)",
      "value": "5,2 mmol/L",
      "reference": "3,9 – 6,1"
    }
  ]
}
```

| Maydon | Majburiy | Izoh |
| --- | --- | --- |
| `phone` | ha | Bemor telefoni. Istalgan formatda — tizim o'zi `+998XXXXXXXXX` ga keltiradi |
| `order_id` | yo'q | 1C dagi buyurtma raqami |
| `date` | yo'q | Natija sanasi (ISO 8601). Berilmasa — hozirgi vaqt |
| `results[].code` | ha | Tahlil kodi (price.csv dagi kod bilan bir xil) |
| `results[].title` | ha | Tahlil nomi |
| `results[].value` | ha | Matn natija, masalan `5,2 mmol/L` |
| `results[].reference` | yo'q | Norma oralig'i |

Bitta so'rovda bir nechta natija yuborish mumkin.

**PDF yuborilmaydi.** Faqat matn qiymat yuboriladi — bemor kabinetda
"PDF" tugmasini bossa, sayt blankni brauzerning o'zida yasab beradi.
Shu sababli fayl saqlash (S3) umuman kerak emas.

## Javob

Muvaffaqiyatli:

```json
{ "ok": true, "saved": 2 }
```

Xato holatlar:

| Kod | Sabab |
| --- | --- |
| 401 | `X-API-Key` noto'g'ri |
| 400 | `phone` yo'q yoki `results` bo'sh |
| 500 | Server tomonda xatolik (dasturchiga avtomatik xabar boradi) |

## 1C 8.x da namuna

```bsl
Соединение = Новый HTTPСоединение("dimed.uz", 443, , , , , Новый ЗащищенноеСоединениеOpenSSL);

Запрос = Новый HTTPЗапрос("/api/lc-results");
Запрос.Заголовки.Вставить("Content-Type", "application/json");
Запрос.Заголовки.Вставить("X-API-Key", КлючAPI);
Запрос.УстановитьТелоИзСтроки(ТелоJSON, КодировкаТекста.UTF8);

Ответ = Соединение.ОтправитьДляОбработки(Запрос);
Если Ответ.КодСостояния <> 200 Тогда
    ЗаписьЖурналаРегистрации("Dimed", УровеньЖурналаРегистрации.Ошибка, , , Ответ.ПолучитьТелоКакСтроку());
КонецЕсли;
```

## Sinov

Ishga tushirishdan oldin test so'rov bilan tekshiring:

```bash
curl -X POST https://dimed.uz/api/lc-results \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $LC_API_KEY" \
  -d '{"phone":"+998901234567","results":[{"code":"96","title":"Gemoglobin","value":"132 g/L","reference":"120 – 160"}]}'
```

Javobda `{"ok":true,"saved":1}` kelsa — integratsiya ishlayapti.

---

# Bemor profili — 1C bilan maydonlar kelishuvi

Bu bo'lim tahlil natijasiga taalluqli emas. U bemor **profilini** 1C bilan
sinxronlashda ikki tomon bir xil maydon nomlari va formatidan foydalanishi
uchun. Maqsad: bir xil ismli bemorlarni adashtirmaslik va sinxronizatsiyada
nomuvofiqlik bo'lmasligi.

## Bog'lovchi kalitlar

| Kalit | Rol |
| --- | --- |
| `phone` | **Asosiy bog'lovchi.** Bemor saytga Telegram orqali kiradi — telefoni shundan olinadi. 1C ham shu telefon bo'yicha bemorni topadi. |
| `code` | 1C dagi bemor **kodi** (rasmda qavs ichidagi raqam). Yagona va o'zgarmas. Telefon o'zgarsa ham bir xil qoladi. Sayt uni saqlaydi va `code-index` orqali qidiradi. |

Ism-familiya **bog'lovchi emas** — bir xil ismli bemorlar `phone` va `code`
orqali ajratiladi.

## Maydonlar

Sayt `dimed_users` yozuvida quyidagi maydonlarni saqlaydi. 1C tomon shu
nomlar va formatga amal qilsa, sinxronizatsiyada moslashtirish shart emas.

| Bazada (sayt) | 1C (Jismoniy shaxs) | Format | Izoh |
| --- | --- | --- | --- |
| `code` | Code | matn | 1C bemor kodi — yagona ID |
| `last_name` | Familiyasi | matn | |
| `first_name` | Ismi | matn | |
| `patronymic` | Sharif | matn | |
| `full_name` | To'liq Ismi | matn | Bo'sh bo'lsa sayt `Familiya Ism` dan yig'adi |
| `gender` | Jinsi | `male` / `female` | Erkak → `male`, Ayol → `female` |
| `birth_date` | Tug'ilgan kuni | `YYYY-MM-DD` | Masalan `1990-04-25` |
| `phone` | Telefon | `+998XXXXXXXXX` | Bog'lovchi kalit. Sayt istalgan formatni shu ko'rinishga keltiradi |
| `email` | Email | matn | Ixtiyoriy |

Telegram `/start` da sayt `phone`, `first_name`, `last_name`, `full_name` ni
o'zi to'ldiradi. Qolgan maydonlar (`code`, `patronymic`, `gender`,
`birth_date`, `email`) — 1C tomondan keladi.

> Qayta `/start` bosilganda 1C to'ldirgan maydonlar **o'chmaydi** — sayt
> faqat Telegram bergan maydonlarni yangilaydi.

## 1C to'g'ridan-to'g'ri DynamoDB'ga yozadi (joriy usul)

1C dasturchisi bemor profilini alohida jadvalga o'zi yozadi — sayt
API'si shart emas. Kelishuv:

| Sozlama | Qiymat |
| --- | --- |
| Jadval nomi (`DynamoDBIndividualsTable` konstantasi) | **`dimed_individuals`** |
| Region | **`us-east-1`** |
| Partition key | `phone` (String) — `+998XXXXXXXXX`, plyus bilan |
| Sort key | `sort_key` (String) — **1C bemor kodi** (`IndividualRef.Code`) |

Maydonlar (1C yuboradigan nomlar): `Surname`, `Name`, `Patronymic`,
`FullName`, `IsMale` (BOOL), `Birthday`, `Email`, `PriceCategory`,
`BirthArea`, `ResidenceArea`, `Address`, `WhereHeard`.

Alohida `Code` maydoni kerak emas — kod `sort_key` ning o'zi. Shu
tufayli bir telefon ostida bir nechta bemor (oila a'zolari) sig'adi,
har biri o'z kodi bilan. Sayt profilni birlashtirishda Telegram bergan
ism bilan solishtirib mos kelganini oladi; mos kelmasa — birinchisini.

Bemor o'chirishga belgilangan bo'lsa `DeletionMark` (BOOL) yuboring —
sayt uni profil sifatida olmaydi. Batafsil: «Sayt tomonining javobi».

Sayt bu jadvaldan **o'zi o'qiydi**: bemor botga kontakt ulashganda va
har saytga kirishda profil `dimed_users` ga birlashtiriladi (yuqoridagi
snake_case nomlar bilan). 1C jadvalga xohlagan payt yozaveradi.

1C tomonga iltimos: **`Birthday` ni `Format(..., "DF=yyyy-MM-dd")`**
bilan yozing. `DLF=D` (25.04.1990) ham qabul qilinadi, lekin ISO
ishonchliroq.

> Diqqat: `dimed_lab_results` ga yozmang — u tahlil natijalari uchun,
> kaliti o'xshash bo'lsa ham. Profil faqat `dimed_individuals` ga.

## Tahlil natijalari to'g'ridan-to'g'ri DynamoDB'ga (joriy usul)

Profil singari, laboratoriya natijalarini ham 1C o'zi yozadi. Kelishuv:

| Sozlama | Qiymat |
| --- | --- |
| Jadval nomi (`DynamoDBAnalysisResultTable` konstantasi) | **`dimed_analysis_results`** |
| Region | **`us-east-1`** |
| Partition key | `phone` (String) — `+998XXXXXXXXX`, plyus bilan |
| Sort key | `sort_key` (String) — hujjat UUID |

Hujjat maydonlari: `DocumentUID`, `Date`, `SampleID`, `Biomaterial`,
`PatientName`, `PatientBirthday`, `PatientIsMale`, `RegisterDate` va
`AnalysisResults` (ro'yxat: `Analyte`, `Result`, `AnalyteUnit`,
`AnalyteInternationalCode`).

Bundan tashqari `Posted` va `DeletionMark` (BOOL) yuboring: bekor
qilingan yoki o'chirilgan natija kabinetda qolib ketmasligi kerak.
Batafsil: «Sayt tomonining javobi».

Sayt kabinetda har analitni alohida qator qilib ko'rsatadi, PDF ni
brauzerning o'zida yasaydi. `Date` `DLF=DT` (21.08.2026 14:30:00)
kelsa ISO ga o'giriladi — lekin `DF=yyyy-MM-ddTHH:mm:ss` ishonchliroq.

> Diqqat: konstantani standart `AnalysisResult` da qoldirmang —
> **`dimed_analysis_results`** qiling. Sayt kaliti faqat `dimed_*`
> jadvallarni o'qiy oladi (IAM policy), va eski nomdagi jadval
> saytga ko'rinmaydi. Konstanta o'zgargach eski yozuvlarni yangi
> jadvalga qayta yuborish kifoya.

## Sinxronizatsiya yo'nalishi — hali ochiq

Yuqoridagi maydon ro'yxati va `code-index` sayt tomonida tayyor. Ma'lumot
qaysi yo'nalishda oqishini kelishish qoldi:

- **1C → sayt:** 1C bemor profilini saytga yuboradi (tahlil natijasi kabi
  `POST`, `X-API-Key` bilan). Sayt kodni saqlaydi.
- **Sayt → 1C:** yangi bemor saytda bron qilganda 1C uni telefon bo'yicha
  topadi yoki yangi karta ochadi.

Odatda ikkalasi ham kerak. 1C dasturchisi qaysi so'rovni yubora olishini
aytsa — sayt tomonidagi endpoint shu shaklga moslab yoziladi.

## Tez yo'l: CSV orqali birinchi yuklash

API ulanguncha bemorlarni **fayl orqali** yuklash mumkin — 1C
dasturchisiz, 10 daqiqada:

1. 1C'da **Jismoniy shaxslar** ro'yxatini oching
2. Ro'yxat ustida o'ng tugma → **Вывести список** (ro'yxatni chiqarish)
   → kerakli ustunlarni belgilang: Code, Familiyasi, Ismi, Sharif,
   Jinsi, Tug'ilgan kuni, **Telefon** (majburiy), Email
3. Ochilgan jadvalni saqlang (Excel bo'lsa — Excel'da ochib
   **CSV UTF-8** qilib qayta saqlang)
4. Loyiha papkasida:

```bash
node scripts/import-patients.mjs bemorlar.csv --dry   # avval ko'rish
node scripts/import-patients.mjs bemorlar.csv         # yuklash
```

Skript telefonni bot foydalanuvchisi bilan solishtiradi:

- **Mos kelsa** — 1C profili (kod, F.I.Sh., jins, tug'ilgan kun)
  yoziladi. Telegram maydonlariga tegilmaydi.
- **Bemor botga hali kirmagan bo'lsa** — o'tkazib yuboriladi va
  ro'yxatda ko'rsatiladi. U botga kirgach skriptni qayta yurgizing —
  qayta yurgizish xavfsiz (idempotent).

Ustun sarlavhalari avtomatik taniladi (o'zbek/rus/ingliz), ajratgich
`,` `;` yoki TAB bo'lishi mumkin, telefon istalgan formatda.

---

# Sayt tomonining javobi (2026-08-30)

Bu bo'lim 1C dasturchisining `dimed-medhisob.md` hisobotiga javob.
Qisqasi: **shartnoma o'zgarmadi**, sayt esa hisobotdagi nuqsonlarga
chidamli qilib tuzatildi. Quyida faqat 1C tomonidan kutiladigan narsalar
va har bir savolga javob.

## 1C tomonidan kutilayotgani (3 ta yangi maydon)

| Jadval | Maydon | Turi | Nega |
| --- | --- | --- | --- |
| `dimed_analysis_results` | `Posted` | BOOL | Hujjat o'tkazilgan-o'tkazilmagani. `false` bo'lsa sayt natijani **ko'rsatmaydi** |
| `dimed_analysis_results` | `DeletionMark` | BOOL | O'chirishga belgilangan bo'lsa — ko'rsatilmaydi |
| `dimed_individuals` | `DeletionMark` | BOOL | O'chirilgan bemor profil sifatida olinmaydi |

`PatientName` allaqachon yuborilyapti — uni **doim** to'ldiring: bir
telefonga oila a'zolari bog'langanda kabinetda natija kimniki ekani
shundan yoziladi.

> Maydon umuman bo'lmasa, sayt yozuvni **ko'rsataveradi** — eski
> yozuvlar shusiz yotibdi va ular yo'qolmasligi kerak. Ya'ni bu
> maydonlarni qo'shish sizni hech narsadan to'smaydi, faqat bekor
> qilingan natijani kabinetdan olib tashlash imkonini beradi.

**`DeleteItem` kerak emas.** Bekor qilingan hujjatni o'chirish o'rniga
xuddi shu yozuvni `Posted=false` yoki `DeletionMark=true` bilan qayta
yuboring — sayt uni yashiradi. Shu tufayli IAM'ga qo'shimcha huquq ham
kerak emas.

## Savollarga javob

### Shartnoma (1–7)

**1. `sort_key` — `"10482"` yoki `"10 482"`?**
Toza `"10482"` yuboring (sizning kengaytmangiz shunday qiladi — to'g'ri).
Sayt endi kodni o'qiyotganda bo'shliqlarni **o'zi tozalaydi**, shuning
uchun eski yozuvlar ham to'g'ri ko'rinadi. Lekin DynamoDB'da eski
`"10 482"` **alohida qator** bo'lib qoladi — imkoni bo'lsa bemorlarni
yangi formatda bir marta qayta yuboring, biz eskilarini tozalaymiz.

**2. `Date` / `RegisterDate` formati.**
Ikkalasi ham ishlaydi: sayt `DLF=DT` (`28.08.2026 11:42:00`, bir xonali
soat ham) va ISO ni tushunadi. **ISO afzal** — `DF=yyyy-MM-ddTHH:mm:ss`.

**3. `Result` dagi son formati.**
Sayt raqamni **tahlil qilmaydi**, matn sifatida ko'rsatadi. Ya'ni
`"1 234,5"` ham yiqilmaydi, lekin bemorga g'alati ko'rinadi —
`Format(V, "NDS=.; NG=0")` bilan `"1234.5"` yuborganingiz to'g'ri.

**4. Bemor kodi o'zgarganda.**
Sizning **(a) variantingiz** — 1C'da `Code` ni tahrirlashni bloklash.
Bu eng arzon va ishonchli yechim. `sort_key` ni UUID ga o'tkazish
(b varianti) hozir kerak emas: kod amalda o'zgarmasa, muammo yo'q.
Yetim yozuvlarni biz tozalaymiz.

**5. O'chirilgan / bekor qilingan yozuvlar.**
Hal qilindi — yuqoridagi `Posted` / `DeletionMark` maydonlari.
Bu **bemor xavfsizligi masalasi**: bekor qilingan tahlil natijasi
kabinetda qolib ketmasligi kerak. Iltimos shu ikki maydonni qo'shing.

**6. Bemor telefonini o'zgartirsa.**
Eski telefon ostidagi yozuvni `DeletionMark=true` bilan bir marta qayta
yuboring — sayt uni yashiradi. Aks holda eski raqam boshqa odamga
o'tsa, u begona bemor ma'lumotini ko'rishi mumkin.

**7. Bir telefon — bir nechta bemor.**
Sayt **Telegram bergan ism** bo'yicha mos kelganini tanlaydi, mos
kelmasa — birinchisini (eng kichik kod). Natijalar esa hammasi
ko'rsatiladi va har biri `PatientName` bilan belgilanadi.

### Telefon (8–10)

**8. `88` bilan boshlanadigan raqamlar.** Sizning chekinishingiz
**to'g'ri** — `8` ni faqat uzunlik 10 yoki 13 bo'lganda olib tashlang.
O'zgartirmang.

**9. Shahar raqamlari.** Filtrlash **shart emas**. Telegram faqat mobil
raqam beradi, ya'ni shahar raqamli bemor saytga baribir kirmaydi —
yozuv shunchaki ishlatilmay yotadi, zarari yo'q.

**10. Bir maydonda ikkita raqam.** Yubormaslik **to'g'ri**. Ularni
jurnalga yozib boring — registrator keyin tuzatadi.

### Ma'lumot (11–14)

So'rovlaringiz to'g'ri, klinika egasi ularni yurgizadi. Sayt tomoni
**hech qanday chegara qo'ymaydi**: natijalar endi sahifama-sahifa,
oxirigacha o'qiladi (avval faqat 50 tasi ko'rinardi). Tarix qancha
katta bo'lsa ham kabinet to'g'ri ishlaydi.

### Infratuzilma (15–20)

Bularning hammasi klinika tomonida. Faqat ikkitasini alohida
ta'kidlaymiz:

- **15.** Fayl rejimi bo'lsa reglament topshirig'i ishlamaydi — bu
  hozirgi «ma'lumot uzilib qoladi» muammosining eng ehtimolli sababi.
  Birinchi navbatda shuni tekshiring.
- **19.** Kodda ochiq qolgan AWS kaliti **almashtirilmoqda**. Yangi
  kalitni faqat konstantaga yozing.

**20.** Jadvallar `On-Demand` rejimida — to'liq yuklashda throttling
bo'lmaydi.

### Navbat / bron (21–23)

**Hozircha hech narsa qilmaymiz.** Sayt bronni o'zida saqlaydi:
shifokor `/kabinet/shifokor` da o'z navbatini kun bo'yicha ko'radi,
registrator esa admin panelda. MedHisob'da vaqt oynasi tushunchasi
yo'q ekan, sun'iy ravishda kiritish foydadan ko'ra chalkashlik keltiradi.

Keyinroq kerak bo'lsa — sizning **C variantingiz** (kengaytmada alohida
`dm_WebBooking` hujjati) eng to'g'ri yo'l. `Document.Sales` ga saytdan
yozmaymiz: kassa va o'zaro hisob-kitobga tegish xavfli.

> **Yangilanish (2026-09-05).** Navbatlarni 1C ga o'tkazish bo'yicha
> alohida qo'llanma tayyor — `docs/1c-sync.md`: navbat yozuvi maydonlari,
> `date-index` bo'yicha o'qish, `dm_WebBooking` bilan bog'lash, chastota
> va tekshiruv ro'yxati.

### Kengaytma (24–25)

**24.** Alohida sozlamalar formasi **kerak emas** — konstantalar yetadi.

**25.** `BatchWriteItem` ni **faqat birinchi to'liq yuklashda**
ishlatsangiz bo'ladi (25 barobar tez). Kundalik ishda `PutItem` qoladi:
xato qaysi yozuvda ekani aniq ko'rinadi.

## Sayt tomonida nima o'zgardi

Hisobotingiz asosida tuzatilgan joylar (1C dan hech narsa talab
qilmaydi):

- natijalar **oxirigacha** o'qiladi — eski 50 talik chegara olib
  tashlandi (to'liq yuklashdan keyin bu kritik bo'lardi);
- bir telefondagi oiladan **to'g'ri bemor** tanlanadi;
- kod bo'shliqlardan tozalanadi (`"10 482"` → `"10482"`);
- analit nomi bo'sh bo'lsa qator yo'qolmaydi — xalqaro kod bilan
  ko'rsatiladi (`PrintName` ni to'ldirsangiz yaxshi bo'ladi);
- `Posted` / `DeletionMark` hisobga olinadi;
- natijada bemor ismi ko'rinadi.

---

# 2026-09-05: natija sahifasi uchun qo'shimcha maydonlar

Saytda tahlil natijasining alohida sahifasi paydo bo'ldi (`/natija`):
bemor jadvali, me'yoriy oraliq, holat (me'yor / yuqori / past) va
shkala. Buning uchun 1C hujjatida hozir yuborilmayotgan uchta narsa
kerak — bo'lmasa sahifa baribir ochiladi, faqat shu ustunlar bo'sh
qoladi:

| Nima | Tavsiya etilgan maydon | Qayerda | Format |
| --- | --- | --- | --- |
| Tahlil (panel) nomi | `AnalysisName` | hujjat | matn, masalan `Umumiy qon tahlili` |
| Yuborgan shifokor | `Doctor` | hujjat | matn |
| Me'yor chegaralari | `ReferenceMin`, `ReferenceMax` | analit | son (`NDS=.; NG=0`) yoki matn `Reference` (`"3.9 - 5.6"`, `"< 5.2"`) |
| Me'yordan chetlanish (ixtiyoriy) | `Flag` | analit | `H` / `L` / `N` — bo'lmasa sayt o'zi taqqoslaydi |
| Ko'rsatkich izohi (ixtiyoriy) | `Description` | analit | matn |

Sayt bir nechta ehtimoliy nomni qabul qiladi (to'liq ro'yxat —
`docs/1c-sync.md`, 4.3); qaysi nomni yuborishingizni aytsangiz,
ro'yxat bittaga qisqartiriladi.
