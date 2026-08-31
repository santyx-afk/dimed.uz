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

/**
 * Bemorni tanlash uchun variant.
 *
 * `id` — 1C bemor kodi yoki saytda qo'shilgan yozuvning `local-…`
 * identifikatori. Saytdagi hamma joyda shu id bilan ishlanadi.
 */
export type PatientOption = {
  id: string;
  name: string;
  source: '1c' | 'local';
};

/** Saytda qo'lda qo'shilgan oila a'zosi (dimed_users ichida saqlanadi). */
type LocalPatient = {
  id: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
};

type UserRecord = {
  patients?: LocalPatient[];
  active_patient_id?: string;
  telegram_name?: string;
  name?: string;
};

/** "Familiya Ism Sharif" — bo'sh bo'laklarsiz. */
const fullNameOf = (p: {
  last_name?: string;
  first_name?: string;
  patronymic?: string;
}): string => [p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ');

const readUser = async (telegramId: string): Promise<UserRecord> => {
  const found = await db.send(
    new GetCommand({ TableName: TABLES.users, Key: { telegram_id: telegramId } }),
  );
  return (found.Item ?? {}) as UserRecord;
};

/**
 * Telefonga bog'langan bemorlar ro'yxati.
 *
 * Ikki manba qo'shiladi: 1C katalogidagi (klinikada ro'yxatdan o'tgan)
 * va saytning o'zida qo'shilgan oila a'zolari. Bemor qaysi biri
 * ekanini o'zi tanlaydi — bir raqamdan butun oila foydalanadi.
 */
export async function listPatients(
  phone: string,
  telegramId: string,
): Promise<{ patients: PatientOption[]; activeId: string | null }> {
  const [found, user] = await Promise.all([
    db.send(
      new QueryCommand({
        TableName: TABLES.individuals,
        KeyConditionExpression: 'phone = :p',
        ExpressionAttributeValues: { ':p': phone },
        Limit: 25,
      }),
    ).catch(() => ({ Items: [] })),
    readUser(telegramId),
  ]);

  const fromOneC = ((found.Items ?? []) as IndividualRecord[])
    .filter((one) => one.DeletionMark !== true)
    .map((one) => {
      const raw = one.sort_key !== 'PROFILE' ? one.sort_key : one.Code;
      return {
        id: raw ? normalizeCode(raw) : '',
        name:
          one.FullName?.trim() ||
          fullNameOf({
            last_name: one.Surname,
            first_name: one.Name,
            patronymic: one.Patronymic,
          }),
        source: '1c' as const,
      };
    })
    .filter((one) => one.id && one.name);

  const local = (user.patients ?? []).map((p) => ({
    id: p.id,
    name: fullNameOf(p),
    source: 'local' as const,
  }));

  const patients = [...fromOneC, ...local];
  const activeId =
    user.active_patient_id && patients.some((p) => p.id === user.active_patient_id)
      ? user.active_patient_id
      : null;

  return { patients, activeId };
}

/** Ro'yxatdagi bitta bemor. Topilmasa — null. */
export async function findPatient(
  phone: string,
  telegramId: string,
  id: string,
): Promise<PatientOption | null> {
  const { patients } = await listPatients(phone, telegramId);
  return patients.find((p) => p.id === id) ?? null;
}

/** Ism-familiyani tozalaydi: ortiqcha bo'shliqlarsiz, uzunligi cheklangan. */
const cleanName = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, 60) : '';

/**
 * Saytda yangi oila a'zosini qo'shadi.
 *
 * Klinikada hali ro'yxatdan o'tmagan odam uchun (yangi tug'ilgan bola,
 * qarindosh). 1C keyinchalik o'z kodi bilan yozsa — ikkalasi yonma-yon
 * turadi, tanlashda chalkashlik bo'lmasin deb ism to'liq ko'rsatiladi.
 */
export async function addLocalPatient(
  telegramId: string,
  input: { firstName: unknown; lastName: unknown; patronymic?: unknown },
): Promise<PatientOption | { error: string }> {
  const first_name = cleanName(input.firstName);
  const last_name = cleanName(input.lastName);
  const patronymic = cleanName(input.patronymic);

  if (!first_name || !last_name) return { error: 'Ism va familiya kerak' };

  const user = await readUser(telegramId);
  if ((user.patients ?? []).length >= 20) {
    return { error: 'Juda ko‘p odam qo‘shilgan — klinikaga murojaat qiling' };
  }

  const patient: LocalPatient = {
    id: `local-${crypto.randomUUID().slice(0, 8)}`,
    first_name,
    last_name,
    ...(patronymic ? { patronymic } : {}),
  };

  /*
    list_append + if_not_exists: ro'yxat hali yo'q bo'lsa bo'shdan
    boshlanadi. Butun ro'yxatni qayta yozmaymiz — ikki qurilmadan
    bir vaqtda qo'shilsa ham biri yo'qolmaydi.
  */
  await db.send(
    new UpdateCommand({
      TableName: TABLES.users,
      Key: { telegram_id: telegramId },
      UpdateExpression:
        'SET #p = list_append(if_not_exists(#p, :empty), :new), active_patient_id = :id',
      ExpressionAttributeNames: { '#p': 'patients' },
      ExpressionAttributeValues: { ':empty': [], ':new': [patient], ':id': patient.id },
    }),
  );

  return { id: patient.id, name: fullNameOf(patient), source: 'local' };
}

/** Tanlangan bemorni eslab qoladi (kabinet va bron shu bo'yicha ishlaydi). */
export async function selectPatient(telegramId: string, id: string): Promise<void> {
  await db.send(
    new UpdateCommand({
      TableName: TABLES.users,
      Key: { telegram_id: telegramId },
      UpdateExpression: 'SET active_patient_id = :id',
      ExpressionAttributeValues: { ':id': id },
    }),
  );
}
