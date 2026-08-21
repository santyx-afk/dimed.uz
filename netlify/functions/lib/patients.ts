import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
};

/** 25.04.1990 yoki 1990-04-25 → 1990-04-25. Boshqasi — o'zgarishsiz. */
const normalizeBirthday = (raw: string): string => {
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
};

/**
 * 1C profilini bemorning `users` yozuviga birlashtiradi.
 *
 * Topilmasa jimgina chiqadi: 1C hali bu bemorni yubormagan. Xato
 * yuqoriga otiladi — ushlash chaqiruvchining zimmasida, kirish oqimi
 * bu sababdan to'xtamasligi kerak.
 */
export async function mergeIndividualProfile(phone: string, telegramId: string): Promise<boolean> {
  /*
    Bir telefon ostida bir nechta bemor bo'lishi mumkin (oila) —
    birinchisi olinadi: bot foydalanuvchisi telefon egasi, odatda u
    eng kichik kodli (eng eski) yozuv.
  */
  const found = await db.send(
    new QueryCommand({
      TableName: TABLES.individuals,
      KeyConditionExpression: 'phone = :p',
      ExpressionAttributeValues: { ':p': phone },
      Limit: 1,
    }),
  );
  const individual = found.Items?.[0] as IndividualRecord | undefined;
  if (!individual) return false;

  const profile: Record<string, string> = {};
  // sort_key — 1C bemor kodi. Eski "PROFILE" yozuvlari kod emas.
  const code = individual.sort_key !== 'PROFILE' ? individual.sort_key : individual.Code;
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
