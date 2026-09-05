import type { Config, Context } from '@netlify/functions';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './lib/db.ts';
import { loadResults } from './lib/results.ts';
import { shareUrl } from './result.ts';
import { botText, isLang, type Lang } from './lib/i18n.ts';
import { sendMessage, logToAdmin } from './lib/telegram.ts';
import { json, error } from './lib/http.ts';

/**
 * Yangi tahlil natijasi haqida bemorga bot orqali xabar (G1).
 *
 * 1C natijalarni DynamoDB'ga o'zi yozadi — sayt buni bilmaydi,
 * webhook yo'q. Shuning uchun Netlify Scheduled Function har 15
 * daqiqada botdan o'tgan bemorlarni aylanib chiqadi va har birida
 * hali xabar berilmagan, tayyor hujjatlarni topadi.
 *
 * Takror yubormaslik: xabar berilgan hujjatlar bemor yozuvida
 * `results_notified` ro'yxatida turadi (1C jadvaliga sayt yozmaydi).
 * Birinchi ishga tushishda (ro'yxat hali yo'q) mavjud tarix xabarsiz
 * belgilab qo'yiladi — aks holda hamma eski natija "yangi" bo'lardi.
 */
const NOTIFIED_CAP = 500;
/** Bir ishga tushishda bitta bemorga ko'pi bilan shuncha alohida xabar. */
const MAX_SEPARATE = 3;

type UserRow = {
  telegram_id: string;
  phone?: string;
  lang?: string;
  results_notified?: string[];
};

export default async (request: Request, _context: Context): Promise<Response> => {
  try {
    const { Items = [] } = await db.send(new ScanCommand({ TableName: TABLES.users }));
    const users = (Items as UserRow[]).filter((u) => u.phone && u.telegram_id);

    let checked = 0;
    let sent = 0;
    for (const user of users) {
      checked++;
      try {
        sent += await notifyUser(user, request);
      } catch (err) {
        await logToAdmin(`notify-results/${user.telegram_id}`, err);
      }
    }

    return json({ ok: true, checked, sent });
  } catch (err) {
    await logToAdmin('notify-results', err);
    return error('Natija xabarlarini yuborishda xatolik', 500);
  }
};

export const config: Config = { schedule: '*/15 * * * *' };

const fmtDate = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
};

async function notifyUser(user: UserRow, request: Request): Promise<number> {
  const phone = user.phone as string;
  const groups = await loadResults(phone);
  // Faqat tayyor natijalar: bo'sh (kutilayotgan) hujjat keyin to'lganda xabar oladi.
  const ready = groups.filter((g) => g.status === 'ready');
  const known = new Set(user.results_notified ?? []);

  // Birinchi marta: tarixni jimgina belgilaymiz.
  if (!user.results_notified) {
    await remember(user.telegram_id, ready.map((g) => g.id));
    return 0;
  }

  const fresh = ready.filter((g) => !known.has(g.id));
  if (!fresh.length) return 0;

  // Avval belgilaymiz, keyin yuboramiz — ikki marta xabar ketmasin.
  await remember(user.telegram_id, [...known, ...fresh.map((g) => g.id)]);

  const lang: Lang = isLang(user.lang) ? user.lang : 'uz';
  let sent = 0;

  if (fresh.length > MAX_SEPARATE) {
    await sendMessage(
      user.telegram_id,
      botText('result.ready.many', lang, {
        n: fresh.length,
        link: `${shareUrl(request, phone, fresh[0]!.id).split('/natija')[0]}/kabinet/tahlillar`,
      }),
    );
    return 1;
  }

  for (const group of fresh) {
    await sendMessage(
      user.telegram_id,
      botText('result.ready', lang, {
        title: group.title,
        date: fmtDate(group.date),
        link: shareUrl(request, phone, group.id),
      }),
    );
    sent++;
  }
  return sent;
}

/** Xabar berilgan hujjatlar ro'yxatini yozadi (oxirgi 500 tasi). */
async function remember(telegramId: string, ids: string[]): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.users,
      Key: { telegram_id: telegramId },
      UpdateExpression: 'SET results_notified = :ids',
      ExpressionAttributeValues: { ':ids': ids.slice(-NOTIFIED_CAP) },
    }),
  );
}
