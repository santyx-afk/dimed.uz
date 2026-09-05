/**
 * Ko'p uchraydigan ko'rsatkichlar uchun qisqa tavsif (natija
 * sahifasidagi ⓘ tugmasi, D1). Uch tilda. 1C o'zi Description
 * yuborsa, u ustun bo'ladi.
 *
 * Kalit — analit nomi (kichik harf, faqat harf-raqam) yoki xalqaro
 * (LOINC) kod. Ro'yxat kichik va faqat umumiy ta'riflar — tashxis
 * emas, "bu nima o'lchaydi" darajasida.
 */
export type AnalyteDescription = { uz: string; ru?: string; en?: string };

const byName: Record<string, AnalyteDescription> = {
  gemoglobin: {
    uz: 'Qondagi kislorod tashuvchi oqsil miqdori. Pastligi — kamqonlik belgisi boʻlishi mumkin.',
    ru: 'Белок крови, переносящий кислород. Снижение может указывать на анемию.',
    en: 'Oxygen-carrying protein in the blood. Low values may indicate anaemia.',
  },
  hemoglobin: { uz: 'Qondagi kislorod tashuvchi oqsil miqdori.', ru: 'Белок крови, переносящий кислород.', en: 'Oxygen-carrying blood protein.' },
  eritrotsitlar: { uz: 'Qizil qon tanachalari soni.', ru: 'Количество эритроцитов (красных клеток крови).', en: 'Red blood cell count.' },
  leykotsitlar: {
    uz: 'Oq qon tanachalari — immunitet hujayralari. Koʻpayishi yalligʻlanish yoki infeksiyada kuzatiladi.',
    ru: 'Лейкоциты — клетки иммунитета. Повышение бывает при воспалении или инфекции.',
    en: 'White blood cells — immune cells. Raised in inflammation or infection.',
  },
  trombotsitlar: { uz: 'Qon ivishida ishtirok etadigan hujayralar.', ru: 'Клетки, участвующие в свёртывании крови.', en: 'Cells involved in blood clotting.' },
  echt: { uz: 'Eritrotsitlar choʻkish tezligi — yalligʻlanishning umumiy koʻrsatkichi.', ru: 'СОЭ — общий показатель воспаления.', en: 'ESR — a general marker of inflammation.' },
  soe: { uz: 'Eritrotsitlar choʻkish tezligi — yalligʻlanishning umumiy koʻrsatkichi.', ru: 'СОЭ — общий показатель воспаления.', en: 'ESR — a general marker of inflammation.' },
  glyukoza: {
    uz: 'Qondagi qand miqdori. Och qoringa oʻlchanadi; yuqoriligi qandli diabet xavfini koʻrsatishi mumkin.',
    ru: 'Уровень сахара в крови. Измеряется натощак; повышение может указывать на риск диабета.',
    en: 'Blood sugar level. Measured fasting; high values may indicate diabetes risk.',
  },
  qonshakarglyukoza: { uz: 'Qondagi qand miqdori (och qoringa).', ru: 'Уровень сахара в крови (натощак).', en: 'Fasting blood sugar level.' },
  xolesterin: {
    uz: 'Qondagi umumiy yogʻlar (lipidlar) miqdori — yurak-qon tomir xavfini baholashda ishlatiladi.',
    ru: 'Общий уровень липидов крови — используется для оценки сердечно-сосудистого риска.',
    en: 'Total blood lipids — used to assess cardiovascular risk.',
  },
  umumiyxolesterin: { uz: 'Qondagi umumiy yogʻlar miqdori.', ru: 'Общий уровень липидов крови.', en: 'Total blood lipids.' },
  triglitserid: { uz: 'Qondagi yogʻ turi; ovqat va moddalar almashinuviga bogʻliq.', ru: 'Вид жиров крови; зависит от питания и обмена веществ.', en: 'A type of blood fat linked to diet and metabolism.' },
  kreatinin: {
    uz: 'Mushak almashinuvi mahsuloti; buyrak ishini baholashda asosiy koʻrsatkich.',
    ru: 'Продукт обмена мышц; основной показатель работы почек.',
    en: 'A muscle metabolism product; the main marker of kidney function.',
  },
  mochevina: { uz: 'Oqsil almashinuvi mahsuloti; buyrak faoliyatini koʻrsatadi.', ru: 'Продукт обмена белков; отражает работу почек.', en: 'A protein metabolism product reflecting kidney function.' },
  urea: { uz: 'Oqsil almashinuvi mahsuloti; buyrak faoliyatini koʻrsatadi.', ru: 'Мочевина — отражает работу почек.', en: 'Urea — reflects kidney function.' },
  alt: {
    uz: 'ALT — jigar fermenti. Yuqoriligi jigar hujayralari shikastlanganini koʻrsatishi mumkin.',
    ru: 'АЛТ — печёночный фермент. Повышение может указывать на повреждение клеток печени.',
    en: 'ALT — a liver enzyme. Raised values may indicate liver cell damage.',
  },
  altalaninaminotrasferaza: { uz: 'ALT — jigar fermenti.', ru: 'АЛТ — печёночный фермент.', en: 'ALT — a liver enzyme.' },
  ast: {
    uz: 'AST — jigar va yurak mushagi fermenti.',
    ru: 'АСТ — фермент печени и сердечной мышцы.',
    en: 'AST — an enzyme of the liver and heart muscle.',
  },
  bilirubinumumiy: { uz: 'Oʻt pigmenti; jigar va oʻt yoʻllari holatini koʻrsatadi.', ru: 'Жёлчный пигмент; отражает состояние печени и жёлчных путей.', en: 'Bile pigment; reflects liver and bile duct function.' },
  bilirubin: { uz: 'Oʻt pigmenti; jigar va oʻt yoʻllari holatini koʻrsatadi.', ru: 'Жёлчный пигмент; отражает состояние печени.', en: 'Bile pigment; reflects liver function.' },
  umumiyoqsil: { uz: 'Qon zardobidagi oqsillar yigʻindisi — ovqatlanish va jigar holati.', ru: 'Сумма белков сыворотки — питание и состояние печени.', en: 'Total serum protein — nutrition and liver status.' },
  albumin: { uz: 'Qonning asosiy oqsili; jigar va buyrak holatini aks ettiradi.', ru: 'Основной белок крови; отражает состояние печени и почек.', en: 'The main blood protein; reflects liver and kidney status.' },
  ishqoriyfosfataza: { uz: 'Jigar, oʻt yoʻllari va suyak fermenti.', ru: 'Фермент печени, жёлчных путей и костей.', en: 'An enzyme of the liver, bile ducts and bone.' },
  kaliy: { uz: 'Yurak va mushaklar ishi uchun muhim elektrolit.', ru: 'Электролит, важный для работы сердца и мышц.', en: 'An electrolyte important for heart and muscle function.' },
  kalsiy: { uz: 'Suyak va nerv-mushak faoliyati uchun mineral.', ru: 'Минерал для костей и нервно-мышечной функции.', en: 'A mineral for bones and neuromuscular function.' },
  natriy: { uz: 'Suv-tuz balansining asosiy elektroliti.', ru: 'Основной электролит водно-солевого баланса.', en: 'The main electrolyte of fluid balance.' },
  crpсreaktivoqsil: { uz: 'C-reaktiv oqsil — oʻtkir yalligʻlanish belgisi.', ru: 'С-реактивный белок — маркер острого воспаления.', en: 'C-reactive protein — a marker of acute inflammation.' },
  crp: { uz: 'C-reaktiv oqsil — oʻtkir yalligʻlanish belgisi.', ru: 'С-реактивный белок — маркер острого воспаления.', en: 'C-reactive protein — an acute inflammation marker.' },
  revmatoidfaktor: { uz: 'Revmatoid artrit va boshqa autoimmun kasalliklarda koʻtariladi.', ru: 'Повышается при ревматоидном артрите и других аутоиммунных заболеваниях.', en: 'Raised in rheumatoid arthritis and other autoimmune diseases.' },
  fibrinogen: { uz: 'Qon ivish oqsili; yalligʻlanishda ham koʻtariladi.', ru: 'Белок свёртывания; повышается и при воспалении.', en: 'A clotting protein; also raised in inflammation.' },
  protrombinindeksipti: { uz: 'Qon ivish tizimi koʻrsatkichi (PTI).', ru: 'Показатель системы свёртывания (ПТИ).', en: 'A clotting system indicator (PTI).' },
  ferritin: { uz: 'Organizmdagi temir zaxirasi koʻrsatkichi.', ru: 'Показатель запасов железа в организме.', en: 'An indicator of the body’s iron stores.' },
  umumiytiroksint4: { uz: 'Qalqonsimon bez gormoni (T4).', ru: 'Гормон щитовидной железы (Т4).', en: 'Thyroid hormone (T4).' },
  umumiytriyodtironint3: { uz: 'Qalqonsimon bez gormoni (T3).', ru: 'Гормон щитовидной железы (Т3).', en: 'Thyroid hormone (T3).' },
  ttg: { uz: 'Tireotrop gormon — qalqonsimon bez ishini boshqaradi.', ru: 'ТТГ — регулирует работу щитовидной железы.', en: 'TSH — regulates thyroid function.' },
  tsh: { uz: 'Tireotrop gormon — qalqonsimon bez ishini boshqaradi.', ru: 'ТТГ — регулирует работу щитовидной железы.', en: 'TSH — regulates thyroid function.' },
};

/** LOINC va boshqa xalqaro kodlar bo'yicha (1C AnalyteInternationalCode). */
const byCode: Record<string, AnalyteDescription> = {
  '718-7': byName.gemoglobin!,
  '2345-7': byName.glyukoza!,
  '2093-3': byName.xolesterin!,
  '2571-8': byName.triglitserid!,
  '2160-0': byName.kreatinin!,
  '3094-0': byName.urea!,
  '1742-6': byName.alt!,
  '1920-8': byName.ast!,
  '1975-2': byName.bilirubin!,
  '2885-2': byName.umumiyoqsil!,
  '1751-7': byName.albumin!,
  '6768-6': byName.ishqoriyfosfataza!,
  '2823-3': byName.kaliy!,
  '17861-6': byName.kalsiy!,
  '2951-2': byName.natriy!,
  '1988-5': byName.crp!,
  '2276-4': byName.ferritin!,
  '3016-3': byName.tsh!,
  '6690-2': byName.leykotsitlar!,
  '777-3': byName.trombotsitlar!,
  '789-8': byName.eritrotsitlar!,
  HGB: byName.gemoglobin!,
  WBC: byName.leykotsitlar!,
  RBC: byName.eritrotsitlar!,
  PLT: byName.trombotsitlar!,
  ESR: byName.echt!,
  GLU: byName.glyukoza!,
  CHOL: byName.xolesterin!,
  CREA: byName.kreatinin!,
};

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Nomi yoki kodi bo'yicha tavsif; topilmasa null. */
export function analyteInfo(title: string, code?: string): AnalyteDescription | null {
  const c = code?.trim();
  if (c && byCode[c]) return byCode[c] ?? null;
  const key = norm(title);
  if (!key) return null;
  if (byName[key]) return byName[key] ?? null;
  // "Glyukoza (och qoringa)" → "glyukoza"
  const short = norm(title.replace(/\(.*?\)/g, ''));
  return byName[short] ?? null;
}
