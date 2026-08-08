import { randomUUID } from 'node:crypto';
import { optional } from './env.ts';

/**
 * To'lov tizimi adapteri.
 *
 * RHMT kalitlari kelgunicha sayt "klinikada to'lash" rejimida ishlaydi:
 * slot band qilinadi, to'lov qabulxonada amalga oshiriladi. Kalitlar
 * sozlangach RHMT_ENABLED=1 qilinadi va bir xil interfeys orqali
 * onlayn to'lovga o'tiladi — bron mantig'i o'zgarmaydi.
 */

export type PaymentMode = 'online' | 'at_clinic';

export type PaymentIntent = {
  paymentId: string;
  mode: PaymentMode;
  /** online rejimda — to'lov sahifasi havolasi */
  redirectUrl?: string;
};

export const paymentMode = (): PaymentMode =>
  optional('RHMT_ENABLED') === '1' ? 'online' : 'at_clinic';

export async function createPayment(input: {
  amount: number;
  appointmentKey: string;
  phone: string;
}): Promise<PaymentIntent> {
  const paymentId = randomUUID();

  if (paymentMode() === 'at_clinic') {
    return { paymentId, mode: 'at_clinic' };
  }

  // RHMT hujjatlari kelgach shu yerga haqiqiy so'rov qo'yiladi.
  // Interfeys tayyor: amount, appointmentKey va phone yetarli.
  throw new Error(
    `RHMT_ENABLED=1, lekin integratsiya hali yozilmagan (${input.appointmentKey}, ${input.amount} so'm)`,
  );
}
