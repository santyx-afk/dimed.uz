import { required, optional } from './env.ts';

type ReplyMarkup = {
  keyboard?: { text: string; request_contact?: boolean }[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  remove_keyboard?: boolean;
};

async function callBot(token: string, method: string, payload: unknown): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Bemorga xabar yuborish (asosiy bot). */
export async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: ReplyMarkup,
): Promise<void> {
  const res = await callBot(required('TELEGRAM_BOT_TOKEN'), 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });

  if (!res.ok) {
    throw new Error(`Telegram sendMessage muvaffaqiyatsiz (${res.status}): ${await res.text()}`);
  }
}

/**
 * Xatolikni admin log-botga yuboradi. Log yuborishning o'zi ham
 * yiqilsa, asosiy so'rovni buzmaslik uchun faqat konsolga yoziladi.
 */
export async function logToAdmin(context: string, error: unknown): Promise<void> {
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`[${context}]`, detail);

  const token = optional('TELEGRAM_LOG_BOT_TOKEN');
  const chatId = optional('TELEGRAM_LOG_CHAT_ID');
  if (!token || !chatId) return;

  try {
    await callBot(token, 'sendMessage', {
      chat_id: chatId,
      text: `🚨 <b>${context}</b>\n<pre>${escapeHtml(detail).slice(0, 3500)}</pre>`,
      parse_mode: 'HTML',
    });
  } catch (sendError) {
    console.error('[log-bot yuborilmadi]', sendError);
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
