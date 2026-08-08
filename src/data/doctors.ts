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
  /** Bitta qabul davomiyligi, daqiqada. */
  slotMinutes: number;
  /** Ish kunlari: 0 = yakshanba ... 6 = shanba */
  workdays: number[];
  price: number;
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
    deptId: 'pediatriya',
    experience: '10+ yil',
    photo: '/images/team/narimbetov-alisher.webp',
    hours: 'Du–Sh · 08:30–16:00',
    shifts: [
      { start: '08:30', end: '12:30' },
      { start: '13:30', end: '16:00' },
    ],
    slotMinutes: 15,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 60000,
  },
  {
    id: 'rahimov',
    name: 'Rahimov Umidjon',
    job: 'Oliy toifali pediatr',
    deptId: 'pediatriya',
    experience: '20+ yil',
    photo: '/images/team/rahimov-umid.webp',
    hours: 'Du–Sh · 08:30–15:00',
    shifts: [
      { start: '08:30', end: '12:00' },
      { start: '13:00', end: '15:00' },
    ],
    slotMinutes: 15,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 70000,
  },
  {
    id: 'ashurov',
    name: 'Ashurov Tursunali',
    job: 'Terapevt · Kardiolog',
    deptId: 'terapiya',
    experience: '40+ yil',
    photo: '/images/team/ashurov-tursunali.webp',
    hours: 'Du–Sh · 08:00–17:00',
    shifts: [
      { start: '08:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
    slotMinutes: 15,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 70000,
  },
  {
    id: 'ilxomov',
    name: 'Ilxomov Laziz',
    job: 'Terapevt · Kardiolog',
    deptId: 'terapiya',
    experience: '',
    photo: '/images/team/ilxomov-laziz.webp',
    hours: 'Du–Sh · 09:00–14:00',
    shifts: [{ start: '09:00', end: '14:00' }],
    slotMinutes: 20,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 60000,
  },
  {
    id: 'murtazayeva',
    name: 'Murtazayeva Raʼno',
    job: 'Ginekolog · UTT shifokori',
    deptId: 'ginekologiya',
    experience: '',
    photo: '/images/team/murtazayeva-rano.webp',
    hours: 'Du–Ju · 09:30–16:00',
    shifts: [
      { start: '09:30', end: '12:30' },
      { start: '13:30', end: '16:00' },
    ],
    slotMinutes: 20,
    workdays: [1, 2, 3, 4, 5],
    price: 80000,
  },
  {
    id: 'mansurov',
    name: 'Mansurov Qobil',
    job: 'Bolalar nevrologi',
    deptId: 'nevrologiya',
    experience: '9+ yil',
    photo: '/images/team/mansurov-qobil.webp',
    hours: 'Du–Sh · 09:00–13:00',
    shifts: [{ start: '09:00', end: '13:00' }],
    slotMinutes: 15,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 65000,
  },
  {
    id: 'umatqulov',
    name: 'Umatqulov Husan',
    job: 'Nevrolog · Nevropatolog',
    deptId: 'nevrologiya',
    experience: '',
    photo: '/images/team/umatqulov-husan.webp',
    hours: 'Du–Sh · 08:00–13:00',
    shifts: [{ start: '08:00', end: '13:00' }],
    slotMinutes: 15,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 65000,
  },
  {
    id: 'qobilxojayev',
    name: 'Qobilxoʻjayev Yorqinxoʻja',
    job: 'LOR · Otorinolaringolog',
    deptId: 'lor',
    experience: '3+ yil',
    photo: '/images/team/yorqinxoja-qobulxojayev.webp',
    hours: 'Du–Ya · 16:00–22:00',
    shifts: [
      { start: '16:00', end: '19:00' },
      { start: '19:30', end: '22:00' },
    ],
    slotMinutes: 20,
    workdays: [0, 1, 2, 3, 4, 5, 6],
    price: 70000,
  },
  {
    id: 'abdullayev',
    name: 'Abdullayev Bekmirza',
    job: 'Logoped · Fizioterapevt',
    deptId: 'fizio',
    experience: '10+ yil',
    photo: '/images/team/abdullayev-bekmirza.webp',
    hours: 'Du–Sh · 08:30–17:30',
    shifts: [
      { start: '08:30', end: '12:30' },
      { start: '14:00', end: '17:30' },
    ],
    slotMinutes: 30,
    workdays: [1, 2, 3, 4, 5, 6],
    price: 55000,
  },
];

export const doctorsByDept = (deptId: string) => doctors.filter((d) => d.deptId === deptId);
