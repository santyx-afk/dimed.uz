export type Department = {
  id: string;
  name: string;
  description: string;
  /** src/components/DeptIcon.astro dagi ikonka kaliti */
  icon: 'baby' | 'heart' | 'flower' | 'brain' | 'ear' | 'wave';
};

export const departments: Department[] = [
  {
    id: 'pediatriya',
    name: 'Pediatriya',
    description: '0 yoshdan boshlab bolalar salomatligi: koʻrik, davolash, profilaktika.',
    icon: 'baby',
  },
  {
    id: 'terapiya',
    name: 'Terapiya va Kardiologiya',
    description: 'Ichki aʼzolar va yurak-qon tomir kasalliklari diagnostikasi hamda davosi.',
    icon: 'heart',
  },
  {
    id: 'ginekologiya',
    name: 'Ginekologiya va UTT',
    description: 'Ayollar salomatligi va ultratovush tekshiruvi bitta kabinetda.',
    icon: 'flower',
  },
  {
    id: 'nevrologiya',
    name: 'Nevrologiya',
    description: 'EEG, neyrosonografiya, ignaterapiya — kattalar va bolalar uchun.',
    icon: 'brain',
  },
  {
    id: 'lor',
    name: 'LOR',
    description: 'Quloq, tomoq va burun kasalliklari. Jarrohlik amaliyotlari ham bajariladi.',
    icon: 'ear',
  },
  {
    id: 'fizio',
    name: 'Fizioterapiya va Logopediya',
    description: 'UVCh, elektroforez, massaj, manual terapiya va logoped mashgʻulotlari.',
    icon: 'wave',
  },
];
