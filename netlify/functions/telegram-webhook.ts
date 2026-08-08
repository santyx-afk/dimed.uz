import type { Context } from '@netlify/functions';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { required } from './lib/env.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { generateOtp } from './lib/session.ts';
import { json, normalizePhone } from './lib/http.ts';

const OTP_TTL_SECONDS = 5 * 60;

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number; first_name?: string };
  };
};

const shareContactKeyboard = {
  keyboard: [[{ text: '📱 Kontaktni ulashish', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'POST') return json({ error: 'Faqat POST' }, 405);

  // Telegram webhook'ni faqat bizning secret bilan qabul qilamiz.
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== required('TELEGRAM_WEBHOOK_SECRET')) {
    return json({ error: 'Ruxsat yo‘q' }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return json({ error: 'JSON o‘qib bo‘lmadi' }, 400);
  }

  const message = update.message;
  if (!message) return json({ ok: true });

  try {
    if (message.contact) {
      await handleContact(message.chat.id, message.contact);
    } else if (message.text?.startsWith('/start')) {
      await sendMessage(
        message.chat.id,
        'Assalomu alaykum! <b>Dimed</b> klinikasiga xush kelibsiz.\n\n' +
          'Saytga kirish uchun pastdagi tugma orqali kontaktingizni ulashing.',
        shareContactKeyboard,
      );
    } else if (message.text === '/help') {
      await sendMessage(
        message.chat.id,
        'Buyruqlar:\n/start — kirish kodini olish\n\n' +
          'Savollar uchun: +998 55 9009 103',
      );
    }
  } catch (err) {
    await logToAdmin('telegram-webhook', err);
    // Telegram qayta yubormasligi uchun 200 qaytaramiz.
  }

  return json({ ok: true });
};

async function handleContact(
  chatId: number,
  contact: NonNullable<NonNullable<TelegramUpdate['message']>['contact']>,
): Promise<void> {
  const phone = normalizePhone(contact.phone_number);
  const name = contact.first_name ?? '';
  const now = new Date().toISOString();

  await db.send(
    new PutCommand({
      TableName: TABLES.users,
      Item: { telegram_id: String(chatId), phone, name, updated_at: now },
    }),
  );

  const code = generateOtp();
  await db.send(
    new PutCommand({
      TableName: TABLES.otpCodes,
      Item: {
        phone,
        code,
        telegram_id: String(chatId),
        // DynamoDB TTL: yaroqsiz kodlar o'zi o'chib ketadi.
        expires_at: Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS,
      },
    }),
  );

  await sendMessage(
    chatId,
    `Saytga kirish kodingiz:\n\n<b>${code}</b>\n\n` +
      'Kod 5 daqiqa amal qiladi. Uni hech kimga bermang.',
    { remove_keyboard: true },
  );
}
