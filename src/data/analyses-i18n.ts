import type { Lang } from './i18n';

/**
 * Tahlil nomlarining ru/en tarjimasi.
 *
 * `analyses.json` `npm run build-analyses` bilan `legacy/` dan qayta
 * hosil qilinadi — shuning uchun tarjima o'sha faylga yozilmaydi, aks
 * holda birinchi qayta yig'ishda yo'qolardi. Bu yerda esa kod bo'yicha
 * turadi: yangi tahlil qo'shilsa va tarjimasi hali yozilmagan bo'lsa,
 * sahifada o'zbekcha nomi qoladi — bo'sh joy emas.
 */
type Pair = { ru: string; en: string };

const titles: Record<string, Pair> = {
  '75': { ru: 'Спермограмма', en: 'Semen analysis (spermogram)' },
  '76': { ru: 'Анализ отделяемого уретры у мужчин', en: 'Male urethral smear' },
  '77': { ru: 'Гинекологический мазок (из 3 точек)', en: 'Gynaecological smear (3 sites)' },
  '78': { ru: 'Гинекологический мазок (из 1 точки)', en: 'Gynaecological smear (1 site)' },

  '20': { ru: 'Мочевина', en: 'Urea' },
  '21': { ru: 'Креатинин', en: 'Creatinine' },
  '23': { ru: 'Глюкоза крови', en: 'Blood glucose' },
  '33': { ru: 'АЛТ (аланинаминотрансфераза)', en: 'ALT (alanine aminotransferase)' },
  '34': { ru: 'АСТ (аспартатаминотрансфераза)', en: 'AST (aspartate aminotransferase)' },
  '83': { ru: 'Общий белок', en: 'Total protein' },
  '85': { ru: 'Билирубин общий', en: 'Total bilirubin' },
  '90': { ru: 'Триглицериды', en: 'Triglycerides' },
  '91': { ru: 'Альбумин', en: 'Albumin' },
  '92': { ru: 'Билирубин связанный', en: 'Conjugated bilirubin' },
  '93': { ru: 'Кальций', en: 'Calcium' },
  '94': { ru: 'Калий', en: 'Potassium' },
  '95': { ru: 'Холестерин', en: 'Cholesterol' },
  '96': { ru: 'Гемоглобин', en: 'Haemoglobin' },
  '113': { ru: 'Щелочная фосфатаза', en: 'Alkaline phosphatase' },
  '687': { ru: 'Биохимический анализ крови', en: 'Blood biochemistry panel' },

  '60': { ru: 'Антиген SARS-CoV-2', en: 'SARS-CoV-2 antigen test' },
  '117': { ru: 'Экспресс-тест на гепатит B (HBsAg)', en: 'Hepatitis B express test (HBsAg)' },
  '118': { ru: 'Экспресс-тест на гепатит C (anti-HCV)', en: 'Hepatitis C express test (anti-HCV)' },
  '657': { ru: 'Антитела к SARS-CoV-2, IgG/IgM', en: 'SARS-CoV-2 antibodies, IgG/IgM' },

  '693': { ru: 'Тироксин общий (Т4)', en: 'Total thyroxine (T4)' },
  '694': { ru: 'Трийодтиронин общий (Т3)', en: 'Total triiodothyronine (T3)' },

  '86': { ru: 'Протромбиновый индекс (ПТИ)', en: 'Prothrombin index (PTI)' },
  '87': { ru: 'АЧТВ', en: 'Activated partial thromboplastin time (aPTT)' },
  '88': { ru: 'Фибриноген', en: 'Fibrinogen' },
  '413': { ru: 'Тромбиновое время', en: 'Thrombin time' },
  '798': { ru: 'Коагулограмма, 4 показателя', en: 'Coagulation panel, 4 markers' },

  '40': { ru: 'Ревмопробы, 3 показателя', en: 'Rheumatoid panel, 3 markers' },
  '137': { ru: 'С-реактивный белок (СРБ)', en: 'C-reactive protein (CRP)' },
  '164': { ru: 'Ревматоидный фактор', en: 'Rheumatoid factor' },

  '691': { ru: 'TORCH, 10 в 1, IgG/IgM', en: 'TORCH panel, 10-in-1, IgG/IgM' },

  '19': { ru: 'Общий анализ крови, 14 показателей', en: 'Complete blood count, 14 markers' },
  '29': { ru: 'Общий анализ мочи с микроскопией', en: 'Urinalysis with microscopy' },
  '57': { ru: 'Общий анализ крови с лейкоформулой', en: 'Complete blood count with differential' },
  '84': { ru: 'Анализ кала на паразитов (микроскопия)', en: 'Stool microscopy for parasites' },
  '97': { ru: 'Время свёртывания крови (ВСК)', en: 'Blood clotting time' },
  '141': { ru: 'Общий анализ кала (копрограмма)', en: 'Stool analysis (coprogram)' },
  '662': { ru: 'Анализ мочи по Нечипоренко', en: 'Urine test, Nechiporenko method' },

  '74': { ru: 'Сифилис (RW)', en: 'Syphilis (RPR/RW)' },
};

const groups: Record<string, Pair> = {
  'Ajralma Tahlili': { ru: 'Анализ отделяемого', en: 'Discharge analysis' },
  'Biokimyoviy qon tahlillari': { ru: 'Биохимия крови', en: 'Blood biochemistry' },
  'Ekspress test': { ru: 'Экспресс-тесты', en: 'Express tests' },
  Gormon: { ru: 'Гормоны', en: 'Hormones' },
  Koagulogramma: { ru: 'Коагулограмма', en: 'Coagulation' },
  Revmoproba: { ru: 'Ревмопробы', en: 'Rheumatoid panel' },
  'Torch Infeksiyasi': { ru: 'TORCH-инфекции', en: 'TORCH infections' },
  'Umumiy klinik tahlillar': { ru: 'Общеклинические анализы', en: 'General clinical tests' },
  ZPPP: { ru: 'ИППП', en: 'STI' },
};

const durations: Record<string, Pair> = {
  '24 soat': { ru: '24 часа', en: '24 hours' },
  '180 daqiqa': { ru: '180 минут', en: '180 minutes' },
  '30-60 daqiqa': { ru: '30–60 минут', en: '30–60 minutes' },
};

const pick = (map: Record<string, Pair>, value: string, lang: Lang): string =>
  lang === 'uz' ? value : (map[value]?.[lang] ?? value);

export const analysisTitle = (code: string, title: string, lang: Lang): string =>
  lang === 'uz' ? title : (titles[code]?.[lang] ?? title);

export const analysisGroup = (group: string, lang: Lang): string => pick(groups, group, lang);
export const analysisDuration = (duration: string, lang: Lang): string => pick(durations, duration, lang);
