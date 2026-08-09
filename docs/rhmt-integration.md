# RHMT → dimed.uz: onlayn to'lovni ulash

Bu hujjat **to'lov tizimini ulaydigan dasturchi** uchun. Ikki qismdan
iborat: (1) RHMT dan nima so'rash kerak, (2) kod tomonda nima yozilishi
kerak.

Hozir sayt **«klinikada to'lash»** rejimida to'liq ishlaydi — bemor
slotni band qiladi, pulni qabulxonada to'laydi. RHMT ulanishi bron
mantig'iga tegmaydi, faqat to'lov usuli qo'shiladi.

---

## 1. RHMT dan nima so'raladi

Kalitning o'zi yetarli emas. Kerak bo'ladiganlar:

| Nima | Nega |
| --- | --- |
| **Integratsiya hujjati** | So'rov formati, imzo (signature) algoritmi, xato kodlari. Bularsiz kod yozilmaydi |
| **Merchant ID va maxfiy kalit** | So'rovlarni imzolash uchun |
| **Test muhiti** | Haqiqiy pul aylanmasdan sinash uchun. Test kartalari ham so'ralsin |
| **Callback (webhook) talablari** | Ular qaysi manzilga, qanday formatda va qanday imzo bilan xabar yuboradi |
| **IP ro'yxati** | Ularning serverlari qaysi IP dan keladi (agar cheklov qo'ymoqchi bo'lsak) |
| **Qaytarish (refund) tartibi** | Bemor kelmasa yoki shifokor chiqmasa pul qanday qaytariladi |

**Oxirgi band muhim.** Saytda «shifokor ishga chiqa olmadi» stsenariysi
bor: kun yopiladi va o'sha kundagi barcha navbatlar bekor qilinadi.
Onlayn to'lov yoqilganda bu bemorlarning puli qaytarilishi kerak —
hozircha bu jarayon qo'lda, RHMT hujjati kelgach avtomatlashtirish
mumkinligi ko'riladi.

---

## 2. Hozirgi holat: nima tayyor

Kod tomonda **adapter** yozilgan — bir joyni to'ldirish qoladi.

```
netlify/functions/lib/payment.ts     ← integratsiya shu yerda
netlify/functions/book.ts            ← bron; to'lovni boshlaydi
netlify/functions/payment-webhook.ts ← tasdiqni qabul qiladi (tayyor)
```

`payment.ts` dagi to'ldirilishi kerak bo'lgan joy:

```ts
export async function createPayment(input: {
  amount: number;         // so'mda, butun son
  appointmentKey: string; // "<doctor_id>#<sana>#<vaqt>"
  phone: string;          // "+998901234567"
}): Promise<PaymentIntent> {
  const paymentId = randomUUID();

  if (paymentMode() === 'at_clinic') {
    return { paymentId, mode: 'at_clinic' };
  }

  // ⬇️ RHMT so'rovi shu yerga yoziladi
  throw new Error('RHMT_ENABLED=1, lekin integratsiya hali yozilmagan');
}
```

Qaytarilishi kerak bo'lgan qiymat:

```ts
type PaymentIntent = {
  paymentId: string;     // bizning ichki id (randomUUID) — o'zgartirilmaydi
  mode: 'online';
  redirectUrl: string;   // bemor yo'naltiriladigan to'lov sahifasi
};
```

**`paymentId` ni RHMT ga uzating** (order id / merchant transaction id
sifatida) — webhook qaytganda biz yozuvni shu bo'yicha topamiz.

---

## 3. To'lov oqimi

```
Bemor «Band qilish» bosadi
        │
        ▼
POST /api/book
  1. Slot atomik band qilinadi  → status: hold, hold_until = hozir + 5 daqiqa
  2. payments jadvaliga yozuv   → status: pending
  3. createPayment() chaqiriladi → redirectUrl
        │
        ▼
Bemor RHMT sahifasida to'laydi
        │
        ▼
RHMT → POST /api/payment-webhook
  status: success → navbat "paid" bo'ladi, bemorga Telegram xabar
  status: failed  → navbat "cancelled", slot darhol bo'shaydi
```

**5 daqiqalik hold.** To'lov shu vaqt ichida tugallanmasa, slot boshqa
bemorga ochiladi (`hold_until` o'tgan yozuv ustiga yozish mumkin).
RHMT sahifasida vaqt chegarasi bundan uzunroq bo'lsa — kelishib,
`book.ts` dagi `HOLD_SECONDS` ni moslash kerak.

---

## 4. Bizning webhook — RHMT ga aytiladigan manzil

```
POST https://dimed.uz/api/payment-webhook
Content-Type: application/json
X-Payment-Signature: <PAYMENT_WEBHOOK_SECRET>
```

Tana:

```json
{
  "payment_id": "9f1c...",
  "status": "success",
  "reference": "RHMT-882910"
}
```

| Maydon | Majburiy | Izoh |
| --- | --- | --- |
| `payment_id` | ha | `createPayment` qaytargan `paymentId` |
| `status` | ha | `success` yoki `failed` |
| `reference` | yo'q | RHMT tomonidagi tranzaksiya raqami — tekshiruv uchun saqlanadi |

Javoblar:

| Kod | Ma'no |
| --- | --- |
| 200 `{"ok":true}` | Qabul qilindi |
| 200 `{"ok":true,"alreadyProcessed":true}` | Takroriy xabar — hech narsa o'zgarmadi |
| 401 | `X-Payment-Signature` noto'g'ri |
| 404 | Bunday `payment_id` yo'q |

**Takroriy xabar xavfsiz.** Bir xil `payment_id` ikki marta kelsa
ikkinchisi hech narsani o'zgartirmaydi — RHMT qayta urinsa muammo yo'q.

**Agar RHMT imzo formatini o'zgartira olmasa** (masalan HMAC talab
qilsa), `payment-webhook.ts` dagi imzo tekshiruvi shunga moslanadi —
qolgan mantiq o'zgarmaydi.

---

## 5. Yoqish tartibi

1. `lib/payment.ts` dagi `createPayment` to'ldiriladi
2. RHMT kalitlari Netlify environment variables'ga qo'shiladi
3. `RHMT_ENABLED=1` qilinadi
4. Test muhitida to'liq oqim sinaladi (quyidagi ro'yxat)
5. Prod kalitlarga o'tiladi

`RHMT_ENABLED` bo'sh yoki `1` dan boshqa bo'lsa — sayt avtomatik
«klinikada to'lash» rejimiga qaytadi. Ya'ni **orqaga qaytish bir
o'zgaruvchi bilan** amalga oshadi, deploy talab qilinmaydi.

---

## 6. Sinov ro'yxati

| Holat | Kutilgan natija |
| --- | --- |
| Muvaffaqiyatli to'lov | Navbat `paid`, bemorga Telegram xabar, slot band |
| To'lov rad etildi | Navbat `cancelled`, slot darhol bo'sh |
| Bemar to'lov sahifasini yopib yubordi | 5 daqiqadan keyin slot bo'shaydi |
| Webhook ikki marta keldi | Ikkinchisi `alreadyProcessed: true`, holat o'zgarmaydi |
| Noto'g'ri imzo bilan webhook | 401, holat o'zgarmaydi |
| Ikki bemor bir slotni bir vaqtda oldi | Biriga 409, ikkinchisiga to'lov sahifasi |
| To'langan navbatni ko'chirish | Yangi vaqtga o'tadi, qayta to'lov so'ralmaydi |

Oxirgi bandga e'tibor bering: **vaqtni ko'chirishda qayta to'lov yo'q** —
to'lov navbatga emas, bemorga bog'langan. Ko'chirish `reschedule.ts` da,
u to'lov tizimiga umuman murojaat qilmaydi.

---

## 7. Kodni mahalliy sinash

Haqiqiy AWS va RHMT'siz:

```bash
npm install
npm test          # 44 API testi, ular orasida to'lov oqimi ham bor
```

To'lov webhook'i `scripts/test-api.mjs` da sinaladi — o'sha testlarga
qarab RHMT holatini ham qo'shish mumkin.

Batafsil texnik ma'lumot: [`HANDOFF.md`](HANDOFF.md).
