/**
 * Tahlil (panel) nomini ko'rsatkichlar ro'yxatidan topish.
 *
 * Nega kerak. 1C hujjatda tahlil nomini (`Document.AnalysisResult.Analysis`
 * — "Umumiy qon tahlili Leykoformula bilan") yuborishi kerak, lekin
 * bazadagi 3691 ta eski hujjatda u yo'q. Ularda sayt sarlavhani birinchi
 * ko'rsatkichdan yasardi va kabinetda "Gemoglobin +23" chiqardi — bemor
 * uchun bu tahlil nomi emas, birinchi ko'rsatkichning nomi.
 *
 * Shu modul ko'rsatkichlar to'plamiga qarab tahlilni taniydi. 1C nom
 * yuborsa — u har doim ustun, bu yerga umuman kelinmaydi.
 *
 * Qoida: har panelning "belgilovchi" (discriminating) ko'rsatkichlari
 * boshqa panelda uchramaydi. Shu sababli tartib muhim emas va bir
 * tahlil ikkinchisiga o'xshab ketmaydi. Umumiy nomlar — Leykotsitlar,
 * Eritrotsitlar, Glyukoza, Kreatinin, Oqsil, Qon — qasddan ro'yxatga
 * kiritilmagan: ular ham qonda, ham siydikda, ham najasda uchraydi.
 */

/** Sayt lug'atidagi kalit (`src/data/i18n.ts`) va o'zbekcha nomi. */
export type Panel = { key: string; uz: string };

type PanelRule = Panel & {
  /** Faqat shu panelga xos ko'rsatkich bo'laklari (normallashtirilgan). */
  markers: string[];
  /** Panel tanilishi uchun kerakli eng kam moslik. */
  min: number;
};

/**
 * Taqqoslash uchun normallashtirish: kichik harf, apostrof va
 * bo'shliqlarsiz. 1C bir xil nomni turli apostrof bilan yozadi
 * ("Eritrotsitlar oʻrtacha hajmi" / "o'rtacha"), lotin va kirill
 * aralashadi ("АЧТВ").
 */
const norm = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[ʻʼ’‘`´']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

/*
  Ro'yxat klinikaning haqiqiy tahlillari asosida (src/data/analyses.json)
  va bazadagi hujjatlar shakllari bo'yicha tuzilgan.
*/
const RULES: PanelRule[] = [
  {
    key: 'panel.cbc',
    uz: 'Umumiy qon tahlili',
    markers: [
      'gemoglobin',
      'gematokrit',
      'trombokrit',
      'trombotsitlar',
      'eritrotsitlarortachahajmi',
      'eritrotsitlaranizotsitozi',
      'eritrotsitlarchokishtezligi',
      'donaeritrotsitdagigemoglobinmiqdori',
      'eritrotsitdagigemoglobinkonsentratsiyasi',
      'segmentyadrolineytrofil',
      'tayoqchayadrolineytrofil',
      'eozinofillar',
      'bazofillar',
      'monotsitlar',
      'limfotsitlar',
    ],
    min: 3,
  },
  {
    key: 'panel.urine',
    uz: 'Umumiy siydik tahlili',
    markers: [
      'nitritlar',
      'urobilinogen',
      'siydikkislotalilikdarajasi',
      'nisbiyzichligi',
      'epiteliyyassi',
      'epiteliyotuvchi',
      'epiteliybuyrak',
      'silindrlar',
      'tuzlar',
      'zamburuglarsiydikda',
      'askorbinkislotasi',
      'askorbinkreatinin',
      'mikroalbumin',
      'eritrotsitlarozgarmagan',
      'eritrotsitlarozgargan',
    ],
    min: 4,
  },
  {
    key: 'panel.stool',
    uz: 'Najas tahlili',
    markers: [
      'gijjatuxumlari',
      'yodofilflora',
      'kraxmal',
      'neytralyog',
      'yogkislotalari',
      'sovun',
      'biriktruvchitoqima',
      'hazmbolmaganovqatqoldigi',
      'hazmbolmaganosimliktolasi',
      'soddahayvonlar',
    ],
    min: 4,
  },
  {
    key: 'panel.coagulogram',
    uz: 'Koagulogramma',
    markers: [
      'fibrinogen',
      'protrombinindeksi',
      'protrombinvaqti',
      'qismantromboplastinfaollanishvaqti',
      'mho',
      'trombinvaqti',
    ],
    min: 2,
  },
  {
    key: 'panel.biochem',
    uz: 'Biokimyoviy qon tahlili',
    markers: [
      'alt',
      'ast',
      'altalaninaminotrasferaza',
      'astaspartatamnotrasferaza',
      'umumiyoqsil',
      'mochevina',
      'xolesterin',
      'triglitserid',
      'albumin',
      'ishqoriyfosfataza',
      'bilirubinumumiy',
      'boglanganbilirubin',
      'kaliy',
      'kalsiy',
      'amilaza',
    ],
    min: 2,
  },
  {
    key: 'panel.rheuma',
    uz: 'Revmoproba',
    markers: ['antistreptolizino', 'creaktivoqsil', 'revmatoidfaktor'],
    min: 2,
  },
  {
    key: 'panel.torch',
    uz: 'TORCH infeksiyalari',
    markers: [
      'toksoplazmoz',
      'qizamiq',
      'sitomegalovirus',
      'gerpes',
      'krasnuxa',
      'xlamidiya',
    ],
    min: 3,
  },
  {
    key: 'panel.express',
    uz: 'Ekspress testlar',
    markers: ['gepatitbekspresstest', 'gepatitcekspresstest', 'sarscov2', 'sifilis', 'rw'],
    min: 2,
  },
];

/**
 * Ko'rsatkich nomi belgiga mos keladimi.
 *
 * Uzun belgilar "ichida bor" bo'yicha izlanadi — 1C nomga izoh
 * qo'shishi mumkin ("Leykotsitlar (siydikda)"). Qisqa qisqartmalar
 * (ALT, AST, MHO, RW) esa faqat to'liq tenglik bilan: "ast"
 * "tromboplastin" ichida ham bor va koagulogrammani biokimyoga
 * o'xshatib qo'yardi.
 */
const matches = (title: string, marker: string): boolean =>
  marker.length <= 4 ? title === marker : title.includes(marker);

/**
 * Ko'rsatkichlar to'plamidan tahlil panelini topadi; tanimasa null.
 *
 * Bir nechta panel mos kelsa eng ko'p belgi topilgani olinadi: bitta
 * hujjatda qon va siydik aralashib ketsa ham ustun turgani ko'rinadi.
 */
export function detectPanel(titles: readonly string[]): Panel | null {
  const seen = titles.map(norm).filter(Boolean);
  if (seen.length < 2) return null;

  let best: { rule: PanelRule; hits: number } | null = null;

  for (const rule of RULES) {
    const hits = rule.markers.filter((m) => seen.some((s) => matches(s, m))).length;
    if (hits >= rule.min && (!best || hits > best.hits)) best = { rule, hits };
  }

  return best ? { key: best.rule.key, uz: best.rule.uz } : null;
}
