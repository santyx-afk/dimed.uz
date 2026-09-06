import type { AgeGroup } from '../lib/age';
import type { Lang } from './i18n';

export type Shift = { start: string; end: string };

export type Doctor = {
  id: string;
  name: string;
  job: string;
  deptId: string;
  experience: string;
  photo: string;
  hours: string;
  /** Kunlik smenalar. Smenalar orasidagi bo'shliq — tanaffus. */
  shifts: Shift[];
  /** Bitta qabul davomiyligi, daqiqada. Standart — 60 (bir soatlik slotlar: 08:30, 09:30, …). */
  slotMinutes: number;
  /** Ish kunlari: 0 = yakshanba ... 6 = shanba */
  workdays: number[];
  price: number;
  /**
   * Saytda ko'rinadimi. `false` — shifokor ishdan bo'shagan yoki vaqtincha
   * qabul qilmaydi: kartasi va bron ro'yxatida chiqmaydi, lekin yozuvi
   * (navbatlar tarixi uchun) saqlanadi. Bazadagi `active` maydoni bilan
   * bir xil; admin paneldan yoqib-o'chiriladi.
   */
  active?: boolean;
  /**
   * Yosh cheklovi: 'all' — hamma yosh (standart), 'adult' — 16 yoshdan
   * katta, 'child' — 16 yoshgacha. Admin paneldan belgilanadi; bron
   * vidjeti mos kelmagan bemorni tanlatmaydi, server ham tekshiradi.
   */
  ageGroup?: AgeGroup;
  /**
   * Lavozimning ru/en tarjimasi. Ism tarjima qilinmaydi; tajriba va ish
   * vaqti esa qat'iy shaklda yozilgani uchun `experienceText` va
   * `hoursText` bilan hosil qilinadi — har shifokorga qo'lda yozilmaydi.
   */
  job_ru: string;
  job_en: string;
};

/**
 * Boshlang'ich ma'lumotlar. 1-hafta oxirida bular DynamoDB Doctors
 * jadvaliga ko'chiriladi va shifokorlar jadvalini o'z kabinetidan
 * boshqara boshlaydi (2-hafta).
 */
export const doctors: Doctor[] = [
  {
    id: 'narimbetov',
    name: 'Narimbetov Alisher',
    job: 'Pediatr',
    job_ru: 'Педиатр',
    job_en: 'Paediatrician',
    deptId: 'pediatriya',
    experience: '10+ yil',
    photo: '/images/team/narimbetov-alisher.webp',
    hours: 'Du–Sh · 08:30–16:00',
    shifts: [
      { start: '08:30', end: '12:30' },
      { start: '13:30', end: '16:00' },
    ],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 60000,
  },
  {
    id: 'rahimov',
    name: 'Rahimov Umidjon',
    job: 'Oliy toifali pediatr',
    job_ru: 'Педиатр высшей категории',
    job_en: 'Senior paediatrician',
    deptId: 'pediatriya',
    experience: '20+ yil',
    photo: '/images/team/rahimov-umid.webp',
    hours: 'Du–Sh · 08:30–15:00',
    shifts: [
      { start: '08:30', end: '12:00' },
      { start: '13:00', end: '15:00' },
    ],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 70000,
  },
  {
    id: 'ashurov',
    name: 'Ashurov Tursunali',
    job: 'Terapevt · Kardiolog',
    job_ru: 'Терапевт · Кардиолог',
    job_en: 'Physician · Cardiologist',
    deptId: 'terapiya',
    experience: '40+ yil',
    photo: '/images/team/ashurov-tursunali.webp',
    hours: 'Du–Sh · 08:00–17:00',
    shifts: [
      { start: '08:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 70000,
  },
  {
    id: 'ilxomov',
    name: 'Ilxomov Laziz',
    job: 'Terapevt · Kardiolog',
    job_ru: 'Терапевт · Кардиолог',
    job_en: 'Physician · Cardiologist',
    deptId: 'terapiya',
    experience: '',
    photo: '/images/team/ilxomov-laziz.webp',
    hours: 'Du–Sh · 09:00–14:00',
    shifts: [{ start: '09:00', end: '14:00' }],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 60000,
  },
  {
    id: 'murtazayeva',
    name: 'Murtazayeva Raʼno',
    job: 'Ginekolog · UTT shifokori',
    job_ru: 'Гинеколог · УЗИ-специалист',
    job_en: 'Gynaecologist · Ultrasound',
    deptId: 'ginekologiya',
    experience: '',
    photo: '/images/team/murtazayeva-rano.webp',
    hours: 'Du–Ju · 09:30–16:00',
    shifts: [
      { start: '09:30', end: '12:30' },
      { start: '13:30', end: '16:00' },
    ],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5],
    price: 80000,
    // Ishdan bo'shagan — saytda ko'rinmaydi (E3). Yangi ginekolog kelganda
    // admin panelda qo'shiladi yoki shu yozuv qayta yoqiladi.
    active: false,
  },
  {
    id: 'mansurov',
    name: 'Mansurov Qobil',
    job: 'Bolalar nevrologi',
    job_ru: 'Детский невролог',
    job_en: 'Paediatric neurologist',
    deptId: 'nevrologiya',
    experience: '9+ yil',
    photo: '/images/team/mansurov-qobil.webp',
    hours: 'Du–Sh · 09:00–13:00',
    shifts: [{ start: '09:00', end: '13:00' }],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 65000,
  },
  {
    id: 'umatqulov',
    name: 'Umatqulov Husan',
    job: 'Nevrolog · Nevropatolog',
    job_ru: 'Невролог · Невропатолог',
    job_en: 'Neurologist',
    deptId: 'nevrologiya',
    experience: '',
    photo: '/images/team/umatqulov-husan.webp',
    hours: 'Du–Sh · 08:00–13:00',
    shifts: [{ start: '08:00', end: '13:00' }],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 65000,
  },
  {
    id: 'qobilxojayev',
    name: 'Qobilxoʻjayev Yorqinxoʻja',
    job: 'LOR · Otorinolaringolog',
    job_ru: 'ЛОР · Оториноларинголог',
    job_en: 'ENT · Otorhinolaryngologist',
    deptId: 'lor',
    experience: '3+ yil',
    photo: '/images/team/yorqinxoja-qobulxojayev.webp',
    hours: 'Du–Ya · 16:00–22:00',
    shifts: [
      { start: '16:00', end: '19:00' },
      { start: '19:30', end: '22:00' },
    ],
    slotMinutes: 60,
    workdays: [0, 1, 2, 3, 4, 5, 6],
    price: 70000,
  },
  {
    id: 'abdullayev',
    name: 'Abdullayev Bekmirza',
    job: 'Logoped · Fizioterapevt',
    job_ru: 'Логопед · Физиотерапевт',
    job_en: 'Speech therapist · Physiotherapist',
    deptId: 'fizio',
    experience: '10+ yil',
    photo: '/images/team/abdullayev-bekmirza.webp',
    hours: 'Du–Sh · 08:30–17:30',
    shifts: [
      { start: '08:30', end: '12:30' },
      { start: '14:00', end: '17:30' },
    ],
    slotMinutes: 60,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 55000,
  },
];

/** Saytda ko'rsatiladigan (faol) shifokorlar — kartalar va bron vidjeti shundan chiziladi. */
export const activeDoctors = doctors.filter((d) => d.active !== false);

export const doctorsByDept = (deptId: string) => activeDoctors.filter((d) => d.deptId === deptId);


/** `job` ning tanlangan tildagi ko'rinishi. */
export const jobText = (d: Doctor, lang: Lang): string =>
  lang === 'ru' ? d.job_ru : lang === 'en' ? d.job_en : d.job;

/*
  Tajriba va ish vaqti qat'iy shaklda yoziladi ("10+ yil",
  "Du–Sh · 08:30–16:00"), shuning uchun tarjimasi hosil qilinadi —
  har shifokorga uchta qatordan yozib chiqilmaydi. Shakl buzilgan
  bo'lsa matn o'zgarishsiz qaytadi: yomon tarjimadan ko'ra o'zbekchasi.
*/
const YEARS: Record<Lang, string> = { uz: 'yil', ru: 'лет', en: 'years' };

export function experienceText(value: string, lang: Lang): string {
  const m = value.match(/^(\d+\+?)\s*yil$/);
  return m ? `${m[1]} ${YEARS[lang]}` : value;
}

/** Du, Se, Ch, Pa, Ju, Sh, Ya — hafta kunlari qisqartmasi. */
const DAYS: Record<string, Record<Lang, string>> = {
  Du: { uz: 'Du', ru: 'Пн', en: 'Mon' },
  Se: { uz: 'Se', ru: 'Вт', en: 'Tue' },
  Ch: { uz: 'Ch', ru: 'Ср', en: 'Wed' },
  Pa: { uz: 'Pa', ru: 'Чт', en: 'Thu' },
  Ju: { uz: 'Ju', ru: 'Пт', en: 'Fri' },
  Sh: { uz: 'Sh', ru: 'Сб', en: 'Sat' },
  Ya: { uz: 'Ya', ru: 'Вс', en: 'Sun' },
};

export function hoursText(value: string, lang: Lang): string {
  return value.replace(/\b(Du|Se|Ch|Pa|Ju|Sh|Ya)\b/g, (day) => DAYS[day]?.[lang] ?? day);
}
