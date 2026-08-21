import type { Context } from '@netlify/functions';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { required } from './lib/env.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { generateOtp } from './lib/session.ts';
import { mergeIndividualProfile } from './lib/patients.ts';
import { json, normalizePhone } from './lib/http.ts';

const OTP_TTL_SECONDS = 5 * 60;

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
    contact?: {
      phone_number: string;
      user_id?: number;
      first_name?: string;
      last_name?: string;
    };
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
      /*
        Kontakt bir marta so'raladi. Telefon allaqachon bog'langan
        bo'lsa — darhol yangi kod yuboriladi: har /start da tugma
        bosishga majburlash bemorni charchatadi.
      */
      const existing = await db.send(
        new GetCommand({
          TableName: TABLES.users,
          Key: { telegram_id: String(message.chat.id) },
        }),
      );
      const phone = (existing.Item as { phone?: string } | undefined)?.phone;

      if (phone) {
        await sendOtp(message.chat.id, phone);
      } else {
        await sendMessage(
          message.chat.id,
          'Assalomu alaykum! <b>Dimed</b> klinikasiga xush kelibsiz.\n\n' +
            'Saytga kirish uchun pastdagi tugma orqali kontaktingizni ulashing.',
          shareContactKeyboard,
        );
      }
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
  const firstName = contact.first_name ?? '';
  const lastName = contact.last_name ?? '';
  const fullName = [lastName, firstName].filter(Boolean).join(' ');
  const now = new Date().toISOString();

  /*
    Put emas, Update: bemor qayta /start bosganda 1C sinxronlagan
    profil maydonlari (code, birth_date, gender, ...) o'chib ketmasligi
    kerak — faqat Telegram bergan maydonlarni yangilaymiz.
    `name` DynamoDB'da band so'z, shuning uchun taxallus bilan.
  */
  await db.send(
    new UpdateCommand({
      TableName: TABLES.users,
      Key: { telegram_id: String(chatId) },
      UpdateExpression:
        'SET phone = :p, first_name = :f, last_name = :l, full_name = :fn, #name = :n, updated_at = :u',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':p': phone,
        ':f': firstName,
        ':l': lastName,
        ':fn': fullName,
        ':n': firstName,
        ':u': now,
      },
    }),
  );

  /*
    1C bemorlar jadvalida bo'lsa, F.I.Sh. va kodini shu yerda olamiz.
    Bu qulaylik, kirish sharti emas — 1C jadvali hali bo'lmasa yoki
    bemor unda topilmasa, kirish baribir davom etadi.
  */
  await mergeIndividualProfile(phone, String(chatId)).catch((err) =>
    logToAdmin('telegram-webhook/1c-profil', err),
  );

  await sendOtp(chatId, phone);
}

/** Yangi kirish kodi yasab yuboradi. */
async function sendOtp(chatId: number, phone: string): Promise<void> {
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

  // <code> — Telegram'da bosilsa nusxalanadi.
  await sendMessage(
    chatId,
    `Saytga kirish kodingiz:\n\n<code>${code}</code>\n\n` +
      'Kod ustiga bossangiz — nusxalanadi. 5 daqiqa amal qiladi, hech kimga bermang.',
    { remove_keyboard: true },
  );
}
