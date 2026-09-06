import type { Lang } from './i18n';

export type Department = {
  id: string;
  name: string;
  description: string;
  /** ru/en tarjimasi — o'zbekchasi yuqoridagi maydonlarda, asosiy til. */
  name_ru: string;
  name_en: string;
  description_ru: string;
  description_en: string;
  /** src/components/DeptIcon.astro dagi ikonka kaliti */
  icon: 'baby' | 'heart' | 'flower' | 'brain' | 'ear' | 'wave';
};

export const departments: Department[] = [
  {
    id: 'pediatriya',
    name: 'Pediatriya',
    description: '0 yoshdan boshlab bolalar salomatligi: koʻrik, davolash, profilaktika.',
    name_ru: 'Педиатрия',
    name_en: 'Paediatrics',
    description_ru: 'Здоровье детей с рождения: осмотр, лечение, профилактика.',
    description_en: 'Children’s health from birth: check-ups, treatment, prevention.',
    icon: 'baby',
  },
  {
    id: 'terapiya',
    name: 'Terapiya va Kardiologiya',
    description: 'Ichki aʼzolar va yurak-qon tomir kasalliklari diagnostikasi hamda davosi.',
    name_ru: 'Терапия и кардиология',
    name_en: 'Internal medicine and cardiology',
    description_ru: 'Диагностика и лечение болезней внутренних органов и сердечно-сосудистой системы.',
    description_en: 'Diagnosis and treatment of internal and cardiovascular conditions.',
    icon: 'heart',
  },
  {
    id: 'ginekologiya',
    name: 'Ginekologiya va UTT',
    description: 'Ayollar salomatligi va ultratovush tekshiruvi bitta kabinetda.',
    name_ru: 'Гинекология и УЗИ',
    name_en: 'Gynaecology and ultrasound',
    description_ru: 'Женское здоровье и ультразвуковое исследование в одном кабинете.',
    description_en: 'Women’s health and ultrasound scanning in one room.',
    icon: 'flower',
  },
  {
    id: 'nevrologiya',
    name: 'Nevrologiya',
    description: 'EEG, neyrosonografiya, ignaterapiya — kattalar va bolalar uchun.',
    name_ru: 'Неврология',
    name_en: 'Neurology',
    description_ru: 'ЭЭГ, нейросонография, иглотерапия — для взрослых и детей.',
    description_en: 'EEG, neurosonography and acupuncture — for adults and children.',
    icon: 'brain',
  },
  {
    id: 'lor',
    name: 'LOR',
    description: 'Quloq, tomoq va burun kasalliklari. Jarrohlik amaliyotlari ham bajariladi.',
    name_ru: 'ЛОР',
    name_en: 'ENT',
    description_ru: 'Болезни уха, горла и носа. Выполняются и хирургические вмешательства.',
    description_en: 'Ear, nose and throat conditions. Surgical procedures are performed too.',
    icon: 'ear',
  },
  {
    id: 'fizio',
    name: 'Fizioterapiya va Logopediya',
    description: 'UVCh, elektroforez, massaj, manual terapiya va logoped mashgʻulotlari.',
    name_ru: 'Физиотерапия и логопедия',
    name_en: 'Physiotherapy and speech therapy',
    description_ru: 'УВЧ, электрофорез, массаж, мануальная терапия и занятия с логопедом.',
    description_en: 'UHF, electrophoresis, massage, manual therapy and speech-therapy sessions.',
    icon: 'wave',
  },
];

/** Bo'lim nomi tanlangan tilda. */
export const deptName = (d: Department, lang: Lang): string =>
  lang === 'ru' ? d.name_ru : lang === 'en' ? d.name_en : d.name;

/** Bo'lim tavsifi tanlangan tilda. */
export const deptText = (d: Department, lang: Lang): string =>
  lang === 'ru' ? d.description_ru : lang === 'en' ? d.description_en : d.description;
