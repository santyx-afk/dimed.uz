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
| Sort key | `sort_key` (String) — profil uchun doim `"PROFILE"` |

Maydonlar (1C yuboradigan nomlar): `Surname`, `Name`, `Patronymic`,
`FullName`, `IsMale` (BOOL), `Birthday`, `Email`, `PriceCategory`,
`BirthArea`, `ResidenceArea`, `Address`, `WhereHeard`.

Sayt bu jadvaldan **o'zi o'qiydi**: bemor botga kontakt ulashganda va
har saytga kirishda profil `dimed_users` ga birlashtiriladi (yuqoridagi
snake_case nomlar bilan). 1C jadvalga xohlagan payt yozaveradi.

1C tomonga ikkita iltimos:

1. **`Code` maydonini ham yuboring** (1C bemor kodi) — bir xil ismli
   bemorlarni ajratish uchun kerak. Hozircha yuborilmayapti.
2. **`Birthday` ni `Format(..., "DF=yyyy-MM-dd")`** bilan yozing.
   `DLF=D` (25.04.1990) ham qabul qilinadi, lekin ISO ishonchliroq.

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
