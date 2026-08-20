# Payme → dimed.uz: onlayn to'lovni ulash

Bu hujjat Payme kassasini ulaydigan odam uchun. Kod tomoni **to'liq
yozilgan va testlangan** — qiladigan ish faqat kassani ochish, kalitlarni
Netlify'ga qo'yish va sinovdan o'tkazish.

To'lov ulanmagunicha sayt "klinikada to'lash" rejimida ishlaydi: bemor
slotni band qiladi, pulni qabulxonada to'laydi. Payme ulanishi bron
mantig'ini o'zgartirmaydi.

## 1. Payme'dan nima olinadi

[merchant.payme.uz](https://merchant.payme.uz) orqali kassa ochiladi
(yuridik shaxs hujjatlari kerak). Kassadan olinadigan narsalar:

| Nima | Qayerga qo'yiladi |
| --- | --- |
| **Kassa ID** (merchant id) | Netlify → `PAYME_MERCHANT_ID` |
| **Ishchi kalit** (key) | Netlify → `PAYME_KEY` |
| **Sinov kaliti** (test key) | Netlify → `PAYME_TEST_KEY` (sinov davrida) |

Kassa sozlamalarida ikkita narsa **shart**:

1. **Endpoint (billing URL):** `https://dimed.uz/api/payment-webhook`
2. **Hisob maydoni nomi:** `order_id` — boshqa nom qo'yilsa to'lov
   o'tmaydi, chunki sayt hisobni shu nom bilan yuboradi va qidiradi.

## 2. Qanday ishlaydi

```
Bemor saytda slot tanlaydi
        │
POST /api/book  →  slot 5 daqiqaga hold qilinadi
        │          javobda redirectUrl (checkout.paycom.uz/...)
        ▼
Bemor Payme sahifasida to'laydi
        │
Payme → POST /api/payment-webhook (JSON-RPC):
   CheckPerformTransaction → CreateTransaction → PerformTransaction
        │
hold → paid, bemorga Telegram'da tasdiq boradi
```

- Summa **tiyinda** yuriladi: 70 000 so'm = 7 000 000 tiyin. Kod buni
  o'zi hisoblaydi (`toTiyin`).
- Hold 5 daqiqa, lekin Payme to'lovi kechiksa ham slot hali bizniki
  bo'lsa to'lov o'tadi. Slot boshqa bemorga o'tib ketgan bo'lsa —
  to'lov rad etiladi va **pul yechilmaydi**.
- To'lov bekor qilinsa yoki qaytarilsa (`CancelTransaction`) slot
  avtomatik bo'shaydi.
- To'lanmagan tranzaksiya 12 soatdan keyin o'z-o'zidan bekor bo'ladi.

## 3. Endpoint qanday himoyalangan

Payme har so'rovda `Authorization: Basic base64("Paycom:KALIT")`
yuboradi. Sayt `PAYME_KEY` va `PAYME_TEST_KEY` ning ikkalasini ham
qabul qiladi — sinov kassasi alohida kalit ishlatadi. Kalitsiz so'rov
`-32504` bilan rad etiladi.

Amalga oshirilgan metodlar: `CheckPerformTransaction`,
`CreateTransaction`, `PerformTransaction`, `CancelTransaction`,
`CheckTransaction`, `GetStatement`.

Xato kodlari protokol bo'yicha: `-31050` buyurtma topilmadi, `-31051`
buyurtma yakunlangan, `-31001` summa noto'g'ri, `-31003` tranzaksiya
topilmadi, `-31008` bajarib bo'lmaydi, `-31099` buyurtma band.

## 4. Yoqish tartibi

1. Kassa ochiladi, kalitlar Netlify'ga qo'yiladi
2. `PAYME_ENABLED=1` qilinadi + **deploy qayta ishga tushiriladi**
3. Payme sandbox ([test.paycom.uz](https://test.paycom.uz)) orqali
   sinov to'lovi o'tkaziladi
4. Ishchi kalit bilan haqiqiy 1 000 so'mlik to'lov sinab ko'riladi

O'chirish: `PAYME_ENABLED` bo'sh qilinsa sayt avtomatik "klinikada
to'lash" rejimiga qaytadi — kod o'zgarmaydi.

## 5. Sinovdan o'tkazish uchun savollar

- [ ] Sandbox'da CheckPerform → Create → Perform zanjiri o'tdimi?
- [ ] To'lovdan keyin bemorga Telegram tasdig'i keldimi?
- [ ] Kabinetda navbat `to'langan` bo'ldimi?
- [ ] CancelTransaction'dan keyin slot bo'shadimi?
- [ ] Noto'g'ri summa `-31001` qaytaryaptimi?
- [ ] 5 daqiqadan keyin to'lansa ham (slot band qilinmagan bo'lsa) o'tdimi?

Kod tomondagi testlar: `npm test` — Payme bloki 7 ta stsenariyni
haqiqiy so'rovlar bilan tekshiradi.
