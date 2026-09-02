import { randomUUID } from 'node:crypto';
import { optional } from './env.ts';

/**
 * To'lov tizimi adapteri — Payme (paycom.uz).
 *
 * Payme kassasi ulangunicha sayt "klinikada to'lash" rejimida ishlaydi:
 * slot band qilinadi, to'lov qabulxonada amalga oshiriladi. Kassa
 * ochilib PAYME_MERCHANT_ID olingach PAYME_ENABLED=1 qilinadi va bir
 * xil interfeys orqali onlayn to'lovga o'tiladi — bron mantig'i
 * o'zgarmaydi. Batafsil: docs/payme-integration.md
 */

export type PaymentMode = 'online' | 'at_clinic';

export type PaymentIntent = {
  paymentId: string;
  mode: PaymentMode;
  /** online rejimda — Payme to'lov sahifasi havolasi */
  redirectUrl?: string;
};

export const paymentMode = (): PaymentMode =>
  optional('PAYME_ENABLED') === '1' && optional('PAYME_MERCHANT_ID') ? 'online' : 'at_clinic';

/** Payme summani tiyinda yuboradi va kutadi: 1 so'm = 100 tiyin. */
export const toTiyin = (som: number): number => Math.round(som * 100);

export async function createPayment(input: {
  amount: number;
  appointmentKey: string;
  phone: string;
}): Promise<PaymentIntent> {
  const paymentId = randomUUID();

  if (paymentMode() === 'at_clinic') {
    return { paymentId, mode: 'at_clinic' };
  }

  /*
    Payme checkout havolasi: base64 ichida kassa ID (m), hisob (ac.*)
    va summa tiyinda (a). Kassa sozlamalarida hisob maydoni nomi
    "order_id" bo'lishi shart — webhook ham shu nom bilan qidiradi.
  */
  const params = [
    `m=${optional('PAYME_MERCHANT_ID')}`,
    `ac.order_id=${paymentId}`,
    `a=${toTiyin(input.amount)}`,
  ].join(';');

  return {
    paymentId,
    mode: 'online',
    redirectUrl: `https://checkout.paycom.uz/${Buffer.from(params).toString('base64')}`,
  };
}
