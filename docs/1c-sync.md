# Navbatlarni 1C bilan sinxronlash — qo'llanma (H3)

> Kim uchun: klinika egasi va 1C (MedHisob) dasturchisi. Sayt tomoni
> tayyor ma'lumotni qanday saqlashi, 1C tomoni uni qanday o'qishi va
> ikki tomon bir-birini qanday tekshirishi shu yerda. Ma'lumot
> **oqimi ikki yo'nalishda**: 1C → sayt (bemor profili, tahlil
> natijalari — ishlayapti) va sayt → 1C (navbatlar — shu hujjat
> taklif qiladi). Tahlil natijalari bo'yicha shartnoma
> `docs/1c-integration.md` da, bu hujjat uni **to'ldiradi**.

## 1. Qisqacha

| Yo'nalish | Nima | Qayerda | Holat |
| --- | --- | --- | --- |
| 1C → sayt | Bemor profili (F.I.Sh., jins, tug'ilgan kun, kod) | `dimed_individuals` | ✅ ishlayapti — 1C kengaytmasi (ДинамоДБЭкспорт) yozadi, sayt o'qiydi |
| 1C → sayt | Tahlil natijalari (hujjat + analitlar) | `dimed_analysis_results` | ✅ ishlayapti; sayt har 15 daqiqada yangisini topib bemorga bot orqali havola yuboradi |
| Sayt → 1C | Navbatlar (kim, qaysi shifokorga, qachon, holati) | `dimed_appointments` | 🟡 taklif: 1C reglament topshirig'i jadvalni o'qib `dm_WebBooking` hujjatini yaratadi |

Umumiy qoida o'zgarmaydi: **har bir jadvalga faqat bitta tomon yozadi.**
1C `dimed_individuals` va `dimed_analysis_results` ga, sayt — qolgan
hammasiga. Navbat jadvalida 1C faqat **o'ziga tegishli belgi** (`onec_ref`,
`synced_at`) qo'yishi mumkin — quyida.

## 2. Mavjud kengaytma (ДинамоДБЭкспорт) nima qiladi

1C konfiguratsiyasiga o'rnatilgan kengaytma ikkita konstanta bilan
ishlaydi va reglament topshirig'i orqali DynamoDB'ga `PutItem` yuboradi:

| Konstanta | Qiymat | Nima yoziladi |
| --- | --- | --- |
| `DynamoDBIndividualsTable` | `dimed_individuals` | Jismoniy shaxs (bemor) kartasi — telefon bo'yicha |
| `DynamoDBAnalysisResultTable` | `dimed_analysis_results` | Laboratoriya natijasi hujjati — telefon bo'yicha |

Kalitlar va yozuv shakli — `docs/1c-integration.md` («1C to'g'ridan-to'g'ri
DynamoDB'ga yozadi»). Kengaytma **o'chirmaydi**: bekor qilingan hujjat
`Posted=false` yoki `DeletionMark=true` bilan qayta yoziladi, sayt uni
yashiradi. Shu tartib navbatlar uchun ham saqlanadi.

Kengaytmaga ikki narsa qo'shilishi kutilmoqda (D1 natija sahifasi uchun):
tahlil (panel) nomi va yuborgan shifokor, me'yoriy oraliq — 4-bo'limdagi
«sayt o'qiydigan nomlar» jadvali.

## 3. DynamoDB tuzilmasi — `phone` / `sort_key`

1C yozadigan ikkala jadval bir xil kalit bilan: **partition key `phone`**
(`+998XXXXXXXXX`, plyus bilan), **sort key `sort_key`**.

| Jadval | `sort_key` | Bir bemorda nechta yozuv |
| --- | --- | --- |
| `dimed_individuals` | 1C bemor **kodi** (`"10482"`, bo'shliqsiz) | Bir telefon ostida oila a'zolari — har biri o'z kodi bilan |
| `dimed_analysis_results` | Hujjat **UUID** | Har buyurtma alohida; tartibi sanaga bog'liq emas, sayt hammasini oxirigacha o'qiydi |

Sayt bemorni `dimed_users` (kalit `telegram_id`) da saqlaydi va
`phone-index` orqali telefonga, `code-index` orqali 1C kodiga bog'laydi.
Navbat yozuvidagi `patient_id` — aynan shu 1C kodi (bemor 1C katalogida
bo'lsa) yoki saytda qo'shilgan oila a'zosining `local-…` identifikatori.

Navbatlar jadvali boshqacha kalitlanadi, chunki uni sayt slot bandligini
atomik tekshirish uchun ishlatadi:

| Jadval | Partition key | Sort key | Indekslar |
| --- | --- | --- | --- |
| `dimed_appointments` | `doctor_day` = `"<doctor_id>#<YYYY-MM-DD>"` | `time` = `"HH:MM"` (Toshkent) | `date-index` (`date` + `starts_at`) — kun bo'yicha; `patient-index` (`phone` + `starts_at`) — bemor bo'yicha |

1C uchun eng qulay yo'l — **`date-index` bo'yicha `Query`**: bitta so'rov
bilan «shu kundagi barcha shifokorlarning navbatlari».

## 4. Maydonlar

### 4.1 Navbat yozuvi (`dimed_appointments`) — sayt yozadi, 1C o'qiydi

| Maydon | Turi | Misol | Izoh |
| --- | --- | --- | --- |
| `doctor_day` | S | `ashurov#2026-09-08` | Kalit: shifokor + kun |
| `time` | S | `10:00` | Kalit: qabul boshlanishi, Toshkent vaqti |
| `doctor_id` | S | `ashurov` | Sayt shifokor identifikatori (`dimed_doctors.doctor_id`) |
| `date` | S | `2026-09-08` | Qabul kuni (Toshkent) — `date-index` kaliti |
| `starts_at` | S | `2026-09-08T05:00:00.000Z` | Boshlanish lahzasi, **ISO, UTC** (Toshkent = UTC+5) |
| `phone` | S | `+998901234567` | Bron qilgan hisob telefoni (1C `phone` kaliti bilan bir xil format) |
| `telegram_id` | S | `39707325` | Bron qilgan Telegram hisobi (1C uchun kerak emas) |
| `patient_id` | S | `10482` yoki `local-1725…` | Navbat kim uchun: 1C bemor kodi yoki saytda qo'shilgan oila a'zosi |
| `patient_name` | S | `Azizova Aziza` | Bemor ismi (bron paytidagi) |
| `patient_birth_date` | S | `1990-04-25` | Tug'ilgan sana, `YYYY-MM-DD` (B1 — majburiy) |
| `privacy_accepted_at` | S | ISO | Maxfiylik siyosatiga rozilik lahzasi (B4) |
| `status` | S | `booked` | Holat — quyidagi jadval |
| `price` | N | `70000` | Qabul narxi, so'm (bron paytidagi) |
| `hold_until` | N | unix sekund | Faqat `hold` holatida (onlayn to'lov) |
| `payment_id` | S | | Faqat onlayn to'lovda |
| `reminded_at` | S | ISO | Bemorga 1 soat oldin eslatma ketgan lahza |
| `marked_at` | S | ISO | Shifokor `done` / `no_show` deb belgilagan lahza (E2) |
| `rating_asked_at`, `rating`, `rated_at` | S, N, S | | Bemor bahosi (G2); 1C uchun ixtiyoriy |
| `created_at`, `updated_at` | S | ISO | |

**Holatlar (`status`):**

| Qiymat | Ma'nosi | 1C ga o'tkaziladimi |
| --- | --- | --- |
| `booked` | Bron kuchda, to'lov qabulxona kassasida | **ha** |
| `paid` | Onlayn to'langan (hozir ishlatilmaydi) | ha |
| `done` | Qabul bo'lib o'tdi (shifokor belgiladi) | ha — holat yangilanadi |
| `no_show` | Bemor kelmadi (shifokor belgiladi) | ha — holat yangilanadi |
| `hold` | Onlayn to'lov kutilmoqda (5 daqiqa) | **yo'q** |
| `moved` | Bemor boshqa vaqtga ko'chirdi — eski yozuv | yo'q (yangi vaqt alohida yozuv bo'lib keladi) |
| `cancelled` | Bekor qilingan | yo'q (1C dagi hujjat bekor qilinadi) |
| `cancelled_by_clinic` | Shifokor ishga chiqa olmadi — klinika bekor qildi | yo'q (1C dagi hujjat bekor qilinadi) |

Vaqtni ko'chirishda sayt **yangi** yozuv ochadi (yangi `doctor_day`/`time`)
va eskisini `moved` qiladi — ya'ni bitta bron 1C ga ikki qator bo'lib
ko'rinadi. 1C hujjatini yangisiga bog'lash uchun ikkala qatorda ham
`phone` + `patient_id` bir xil.

### 4.2 Shifokor (`dimed_doctors`) — sayt yozadi

`doctor_id` (S, kalit), `name`, `job`, `dept_id`, `price` (N),
`slot_minutes` (N, standart 60), `shifts` (L: `{start, end}`),
`workdays` (L: 0 = yakshanba … 6 = shanba), `active` (BOOL),
`rating_sum` / `rating_count` (N).

1C bilan bog'lash uchun `doctor_id` ↔ 1C xodimi mosligi kengaytmada
**bitta lug'at** (yoki `dimed_doctors.onec_ref` maydoni — 1C o'zi
`UpdateItem SET onec_ref` bilan qo'yishi mumkin, sayt bu maydonga
tegmaydi).

### 4.3 Sayt o'qiydigan 1C maydonlari (tasdiqlash kerak)

Natija sahifasi (D1) uchun sayt hujjat va analitda quyidagi nomlarni
**birinchi topilganini** oladi. 1C dasturchisi qaysi nomni yuborishini
tasdiqlasa, ro'yxat bittaga qisqartiriladi:

| Nima | Sayt o'qiydigan nomlar (tartib bilan) | Qayerda |
| --- | --- | --- |
| Tahlil (panel) nomi | `AnalysisName`, `Analysis`, `PanelName`, `Nomenclature`, `ServiceName`, `Title` | hujjat |
| Yuborgan shifokor | `Doctor`, `ReferringDoctor`, `DoctorName`, `Physician` | hujjat |
| Me'yoriy oraliq (matn) | `Reference`, `ReferenceRange`, `ReferenceText`, `Norm`, `NormText` | analit |
| Me'yor pastki / yuqori chegarasi (son) | `ReferenceMin`/`ReferenceMax`, `MinValue`/`MaxValue`, `LowerLimit`/`UpperLimit`, `NormMin`/`NormMax` | analit |
| Me'yordan chetlanish bayrog'i | `Flag` yoki `Status`: `H`/`HIGH`/`↑`, `L`/`LOW`/`↓`, `N` | analit |
| Ko'rsatkich izohi | `Description`, `Comment` | analit |

Tavsiya: **`AnalysisName`**, **`Doctor`**, **`ReferenceMin`/`ReferenceMax`**
(son, `NDS=.; NG=0`), matnli oraliq bo'lsa **`Reference`** (`"3.9 - 5.6"`,
`"< 5.2"`). Bayroq bo'lmasa sayt qiymatni oraliq bilan o'zi taqqoslaydi.
Mavjud maydonlar (`Analyte`, `Result`, `AnalyteUnit`,
`AnalyteInternationalCode`, `PatientName`, `PatientBirthday`,
`PatientIsMale`, `Date`, `Biomaterial`, `SampleID`, `Posted`,
`DeletionMark`) o'zgarmaydi.

## 5. Format

DynamoDB JSON (kengaytma allaqachon shunday yozadi): satr `{"S": …}`,
son `{"N": "70000"}` (**satr ko'rinishida**), mantiqiy `{"BOOL": true}`,
ro'yxat `{"L": [...]}`, xarita `{"M": {...}}`. `date-index` bo'yicha
so'rov:

```json
{
  "TableName": "dimed_appointments",
  "IndexName": "date-index",
  "KeyConditionExpression": "#d = :d",
  "ExpressionAttributeNames": { "#d": "date" },
  "ExpressionAttributeValues": { ":d": { "S": "2026-09-08" } }
}
```

Javob 1 MB da kesiladi — `LastEvaluatedKey` kelsa `ExclusiveStartKey`
bilan davom ettiring (bir kunda 1 MB navbat bo'lmaydi, lekin kod shunga
tayyor bo'lsin). Bitta navbat yozuvi (qisqartirilgan):

```json
{
  "doctor_day": { "S": "ashurov#2026-09-08" },
  "time": { "S": "10:00" },
  "doctor_id": { "S": "ashurov" },
  "date": { "S": "2026-09-08" },
  "starts_at": { "S": "2026-09-08T05:00:00.000Z" },
  "phone": { "S": "+998901234567" },
  "patient_id": { "S": "10482" },
  "patient_name": { "S": "Azizova Aziza" },
  "patient_birth_date": { "S": "1990-04-25" },
  "status": { "S": "booked" },
  "price": { "N": "70000" },
  "created_at": { "S": "2026-09-05T12:41:03.512Z" }
}
```

Vaqtlar: `date` va `time` — **Toshkent** (klinika vaqti), `starts_at` va
`*_at` — **UTC** ISO. 1C da `starts_at` ni `Дата` ga o'girishda +5 soat
qo'shiladi (yoki `date` + `time` dan to'g'ridan-to'g'ri yig'iladi —
osonroq va aniq).

## 6. Yo'nalish va chastota

### 6.1 1C → sayt (hozir ishlayotgani)

- **Nima:** bemor kartasi (`dimed_individuals`) va natija hujjati
  (`dimed_analysis_results`).
- **Qachon:** reglament topshirig'i — hozirgi sozlama (har bir necha
  daqiqada yangi/o'zgargan hujjatlar). Fayl rejimidagi 1C'da reglament
  ishlamaydi — «ma'lumot uzilib qoladi» ning birinchi sababi shu.
- **Sayt tomoni:** profil har kirishda `dimed_users` ga birlashtiriladi;
  natijalar kabinetda darhol ko'rinadi, bot xabari `notify-results`
  cron'i orqali **har 15 daqiqada** (yangi tayyor hujjat topilsa —
  nom, sana va sahifa havolasi).

### 6.2 Sayt → 1C (taklif: navbatlar)

Tavsiya — **1C tomondan o'qish (pull)**, chunki 1C serveri internetdan
ochiq emas va kengaytma DynamoDB bilan allaqachon gaplasha oladi:

1. Reglament topshirig'i **har 5–10 daqiqada** `date-index` bo'yicha
   bugundan 7 kun oldinga so'raydi (7 ta `Query`).
2. Har qator uchun kengaytmadagi **`dm_WebBooking`** hujjati (1C dasturchisi
   taklif qilgan C-variant) topiladi yoki yaratiladi. Kalit — `doctor_day`
   + `time` + `created_at` (ko'chirilgan navbat yangi `created_at` bilan
   keladi). `Document.Sales` ga saytdan yozilmaydi — kassa va o'zaro
   hisob-kitobga tegilmaydi; qabul bo'lib o'tgach registrator o'zi
   `dm_WebBooking` asosida sotuv hujjatini kiritadi.
3. `status` o'zgarishi hujjatga ko'chadi: `done` / `no_show` — belgi,
   `moved` / `cancelled*` — hujjat bekor qilinadi (`Posted=false`).
4. Qayta ishlangan qatorga 1C **`UpdateItem`** bilan `onec_ref` (hujjat
   UUID) va `synced_at` (ISO) qo'yadi. Sayt bu maydonlarni o'qimaydi, lekin
   saqlaydi — keyingi aylanishda `attribute_not_exists(synced_at) OR
   updated_at > synced_at` bo'lganlar qayta ishlanadi. Boshqa maydonlarni
   1C **o'zgartirmaydi** (`status` ham) — u saytniki.

Alternativ — **push**: sayt har bronda 1C HTTP-servisiga `POST` yuboradi.
Bu 1C serverini internetga ochishni talab qiladi va so'rov yetib bormasa
navbat yo'qoladi; shuning uchun tavsiya etilmaydi. Kelajakda kerak bo'lsa
sayt tomonida `book` / `reschedule` / `doctor-off` / `appointment-status`
funksiyalariga bitta `notifyOneC()` chaqiruvi qo'shiladi.

IAM (1C kaliti) uchun qo'shimcha huquq: `dynamodb:Query` —
`table/dimed_appointments` va `table/dimed_appointments/index/date-index`,
`dynamodb:UpdateItem` — `table/dimed_appointments` (faqat `onec_ref`,
`synced_at`). `DeleteItem` **kerak emas**.

## 7. Xatolarni tekshirish

**1C tomonida**
- Har `PutItem`/`Query`/`UpdateItem` javobi tekshiriladi: HTTP 200 emas —
  `ЗаписьЖурналаРегистрации` (журнал регистрации) ga to'liq javob bilan;
  `ProvisionedThroughputExceededException` / `ThrottlingException` —
  qisqa kutib qayta urinish (jadvallar On-Demand, amalda uchramaydi);
  `ConditionalCheckFailedException` — yozuv o'zgargan, keyingi aylanishda
  qayta olinadi.
- Reglament topshirig'i **oxirgi muvaffaqiyatli vaqtini** konstantada
  saqlaydi; u 30 daqiqadan eskirsa — 1C administratoriga ogohlantirish.
- Telefonsiz yoki ikki raqamli bemor yuborilmaydi va jurnalga yoziladi
  (`docs/1c-integration.md`, 8–10-savollar).

**Sayt tomonida**
- Barcha xatolar log-botga (Telegram guruh) tushadi: `me/1c-natijalar`,
  `notify-results`, `ask-ratings` kabi kontekst bilan.
- `dimed_analysis_results` dagi hujjat kabinetda ko'rinmasa: `phone`
  formati (`+998…`), `Posted`/`DeletionMark`, jadval nomi
  (`dimed_analysis_results`, standart `AnalysisResult` emas) tekshiriladi.

**Birgalikda — solishtirish ro'yxati (haftada bir)**
1. Bir kun uchun `date-index` dagi `booked/paid/done/no_show` qatorlar soni
   = 1C dagi `dm_WebBooking` hujjatlari soni.
2. Tasodifiy 3 ta navbat: `patient_id` 1C kodi bilan mos, `starts_at`
   Toshkent vaqtiga to'g'ri (+5 soat).
3. Kechagi natijalar: 1C da o'tkazilgan hujjatlar soni = bemor kabinetida
   ko'ringanlar (bot xabari ketganlar `dimed_users.results_notified` da).
4. Sinov navbati (test bemor) → 1C da hujjat paydo bo'ldimi → shifokor
   «Qabul qilindi» → 1C da belgi yangilandimi.

## 8. Ochiq savollar (1C dasturchisi bilan kelishiladi)

1. Sayt → 1C yo'nalishi **kerakmi hozir**? (Sayt navbatni o'zida to'liq
   saqlaydi: shifokor kabineti, admin panel.) Kerak bo'lsa — pull
   (6.2) tasdiqlansin.
2. `dm_WebBooking` hujjatining maydonlari: bemor (1C kodi bo'yicha
   topiladi; topilmasa — `patient_name` + `patient_birth_date` bilan yangi
   karta?), shifokor (`doctor_id` ↔ xodim), sana-vaqt, narx, holat.
3. Natija hujjatida `AnalysisName`, `Doctor`, `ReferenceMin`/`ReferenceMax`
   (4.3) — qaysi nomda va qachon yuboriladi.
4. Chastota: 5 yoki 10 daqiqa; 1C serveri fayl rejimida emasligi
   tasdiqlansin.
