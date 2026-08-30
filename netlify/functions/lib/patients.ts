import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLES } from './db.ts';

/**
 * 1C `individuals` jadvalidagi bemor profili. 1C o'zi yozadi:
 * kalit — telefon (+998...) va sort_key = 1C bemor kodi, maydonlar
 * inglizcha (Surname, Name, ...). Bu yerda o'qib, saytning
 * snake_case nomlariga o'giramiz.
 */
type IndividualRecord = {
  phone?: string;
  sort_key?: string;
  Code?: string;
  Surname?: string;
  Name?: string;
  Patronymic?: string;
  FullName?: string;
  IsMale?: boolean;
  Birthday?: string;
  Email?: string;
  PriceCategory?: string;
  BirthArea?: string;
  ResidenceArea?: string;
  Address?: string;
  WhereHeard?: string;
  /* 1C bemorni o'chirishga belgilasa — profil sifatida olinmaydi. */
  DeletionMark?: boolean;
};

/** 25.04.1990 yoki 1990-04-25 → 1990-04-25. Boshqasi — o'zgarishsiz. */
const normalizeBirthday = (raw: string): string => {
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
};

/*
  1C bemor kodini son sifatida saqlaydi, matnga o'girganda esa guruh
  ajratkichi qo'shilib qolishi mumkin: "10 482". Kod — identifikator,
  bo'shliqsiz saqlanadi, aks holda bitta bemor ikki xil kod bilan
  ko'rinadi.
*/
const normalizeCode = (raw: string): string => raw.replace(/\s+/g, '');

/** Ismlarni taqqoslash uchun: kichik harf, faqat harf va raqam. */
const nameKey = (raw: string): string => raw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Bir telefon ostidagi bemorlardan Telegram egasiga mos kelganini tanlaydi.
 *
 * Oila bitta raqamdan foydalanadi (ota-ona bolasini yozdiradi), shuning
 * uchun "birinchisini ol" qoidasi noto'g'ri odamni tanlab qo'yishi mumkin
 * edi. Telegram bergan ism bilan solishtiramiz; hech biri mos kelmasa —
 * birinchisi (eng kichik kodli, odatda eng eski yozuv).
 */
async function pickForTelegram(
  first: IndividualRecord,
  rest: IndividualRecord[],
  telegramId: string,
): Promise<IndividualRecord> {
  const user = await db
    .send(new GetCommand({ TableName: TABLES.users, Key: { telegram_id: telegramId } }))
    .catch(() => undefined);
  const record = user?.Item as { telegram_name?: string; name?: string } | undefined;

  const wanted = new Set(
    (record?.telegram_name ?? record?.name ?? '')
      .split(/\s+/)
      .map(nameKey)
      .filter(Boolean),
  );
  if (wanted.size === 0) return first;

  let best = first;
  let bestScore = 0;
  for (const one of [first, ...rest]) {
    const own = [one.Surname, one.Name, one.Patronymic, ...(one.FullName ?? '').split(/\s+/)]
      .filter((v): v is string => Boolean(v))
      .map(nameKey)
      .filter(Boolean);
    const score = new Set(own.filter((token) => wanted.has(token))).size;
    if (score > bestScore) {
      best = one;
      bestScore = score;
    }
  }
  return best;
}

/**
 * 1C profilini bemorning `users` yozuviga birlashtiradi.
 *
 * Topilmasa jimgina chiqadi: 1C hali bu bemorni yubormagan. Xato
 * yuqoriga otiladi — ushlash chaqiruvchining zimmasida, kirish oqimi
 * bu sababdan to'xtamasligi kerak.
 */
export async function mergeIndividualProfile(phone: string, telegramId: string): Promise<boolean> {
  /*
    Bir telefon ostida bir nechta bemor bo'lishi mumkin (oila bitta
    raqamdan foydalanadi). Hammasi o'qiladi va Telegram egasiga mos
    kelgani tanlanadi — chegara oilaga yetarli.
  */
  const found = await db.send(
    new QueryCommand({
      TableName: TABLES.individuals,
      KeyConditionExpression: 'phone = :p',
      ExpressionAttributeValues: { ':p': phone },
      Limit: 25,
    }),
  );
  const [first, ...rest] = ((found.Items ?? []) as IndividualRecord[]).filter(
    (one) => one.DeletionMark !== true,
  );
  if (!first) return false;

  const individual = rest.length === 0 ? first : await pickForTelegram(first, rest, telegramId);

  const profile: Record<string, string> = {};
  // sort_key — 1C bemor kodi. Eski "PROFILE" yozuvlari kod emas.
  const raw = individual.sort_key !== 'PROFILE' ? individual.sort_key : individual.Code;
  const code = raw ? normalizeCode(raw) : '';
  if (code) profile.code = code;
  if (individual.Surname) profile.last_name = individual.Surname;
  if (individual.Name) profile.first_name = individual.Name;
  if (individual.Patronymic) profile.patronymic = individual.Patronymic;
  if (individual.FullName) profile.full_name = individual.FullName;
  if (typeof individual.IsMale === 'boolean') profile.gender = individual.IsMale ? 'male' : 'female';
  if (individual.Birthday) profile.birth_date = normalizeBirthday(individual.Birthday);
  if (individual.Email) profile.email = individual.Email;
  if (individual.PriceCategory) profile.price_category = individual.PriceCategory;
  if (individual.Address) profile.address = individual.Address;
  if (Object.keys(profile).length === 0) return false;

  const names: Record<string, string> = { '#upd': 'synced_1c_at' };
  const values: Record<string, string> = { ':upd': new Date().toISOString() };
  const sets = Object.entries(profile).map(([field, value], i) => {
    names[`#f${i}`] = field;
    values[`:v${i}`] = value;
    return `#f${i} = :v${i}`;
  });

  await db.send(
    new UpdateCommand({
      TableName: TABLES.users,
      Key: { telegram_id: telegramId },
      UpdateExpression: `SET ${sets.join(', ')}, #upd = :upd`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
  return true;
}
