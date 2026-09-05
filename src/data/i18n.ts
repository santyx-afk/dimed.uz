/**
 * Sayt matnlari — uch tilda (uz asosiy, ru, en).
 *
 * Sayt tarixan faqat o'zbekcha; yangi qo'shilgan matnlar shu lug'atda
 * uch tilda saqlanadi. Til brauzerda `?lang=` yoki `localStorage`
 * (`dimed_lang`) orqali tanlanadi — qarang `src/lib/lang.ts`.
 * Bot xabarlari uchun server tomonida alohida lug'at bor:
 * `netlify/functions/lib/i18n.ts` (bir xil kalitlar).
 */
export type Lang = 'uz' | 'ru' | 'en';

export const LANGS: readonly Lang[] = ['uz', 'ru', 'en'] as const;

export const LANG_NAMES: Record<Lang, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  en: 'English',
};

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && (LANGS as readonly string[]).includes(value);

type Entry = Record<Lang, string>;

export const messages = {
  // --- umumiy ---
  'common.back': { uz: '← orqaga', ru: '← назад', en: '← back' },
  'common.save': { uz: 'Saqlash', ru: 'Сохранить', en: 'Save' },
  'common.cancel': { uz: 'Bekor qilish', ru: 'Отмена', en: 'Cancel' },
  'common.loading': { uz: 'Yuklanmoqda…', ru: 'Загрузка…', en: 'Loading…' },
  'common.error.network': {
    uz: 'Internetga ulanishda muammo. Qayta urinib koʻring.',
    ru: 'Проблема с подключением. Попробуйте ещё раз.',
    en: 'Connection problem. Please try again.',
  },
  'common.language': { uz: 'Til', ru: 'Язык', en: 'Language' },

  // --- navbat: bemor ma'lumotlari qadami (B1, B4) ---
  'booking.step.patient': { uz: 'Bemor', ru: 'Пациент', en: 'Patient' },
  'booking.step.confirm': { uz: 'Tasdiqlash', ru: 'Подтверждение', en: 'Confirm' },
  'booking.whoFor': { uz: 'Navbat kim uchun?', ru: 'Для кого запись?', en: 'Who is the appointment for?' },
  'booking.birthDate': { uz: 'Tugʻilgan sana', ru: 'Дата рождения', en: 'Date of birth' },
  'booking.birthDate.day': { uz: 'Kun', ru: 'День', en: 'Day' },
  'booking.birthDate.month': { uz: 'Oy', ru: 'Месяц', en: 'Month' },
  'booking.birthDate.year': { uz: 'Yil', ru: 'Год', en: 'Year' },
  'booking.birthDate.required': {
    uz: 'Tugʻilgan sanani toʻliq kiriting.',
    ru: 'Укажите полную дату рождения.',
    en: 'Please enter the full date of birth.',
  },
  'booking.birthDate.missingFor': {
    uz: 'Davom etish uchun bemorning tugʻilgan sanasini kiriting.',
    ru: 'Чтобы продолжить, укажите дату рождения пациента.',
    en: 'Enter the patient’s date of birth to continue.',
  },
  // {link} o'rniga maxfiylik siyosatiga havola qo'yiladi (matni — linkText).
  'booking.privacy.text': {
    uz: '{link}ga roziman',
    ru: 'Я согласен(на) с {link}',
    en: 'I agree to the {link}',
  },
  'booking.privacy.linkText': {
    uz: 'Maxfiylik siyosati',
    ru: 'политикой конфиденциальности',
    en: 'privacy policy',
  },
  'booking.privacy.required': {
    uz: 'Davom etish uchun maxfiylik siyosatiga rozilik bering.',
    ru: 'Чтобы продолжить, примите политику конфиденциальности.',
    en: 'Please accept the privacy policy to continue.',
  },

  // --- navbat: tasdiqlash qadami (B2) ---
  'common.retry': { uz: 'Qayta urinish', ru: 'Повторить', en: 'Try again' },

  // --- 4-qadam: kirish (guest) va yosh cheklovi ---
  'booking.login.title': { uz: 'Davom etish uchun kiring', ru: 'Войдите, чтобы продолжить', en: 'Sign in to continue' },
  'booking.login.lede': {
    uz: 'Navbat kim uchun ekanini bilishimiz uchun Telegram orqali kiring — SMS ham, parol ham kerak emas.',
    ru: 'Войдите через Telegram, чтобы мы знали, для кого запись — без SMS и паролей.',
    en: 'Sign in with Telegram so we know who the appointment is for — no SMS, no password.',
  },
  'booking.login.botStep': { uz: 'Botga /start yuboring va 6 xonali kodni oling', ru: 'Отправьте боту /start и получите 6-значный код', en: 'Send /start to the bot and get the 6-digit code' },
  'booking.login.botBtn': { uz: 'Botni ochish', ru: 'Открыть бота', en: 'Open the bot' },
  'booking.login.phone': { uz: 'Telefon raqamingiz', ru: 'Ваш номер телефона', en: 'Your phone number' },
  'booking.login.code': { uz: 'Botdagi 6 xonali kod', ru: '6-значный код из бота', en: '6-digit code from the bot' },
  'booking.login.button': { uz: 'Kirish', ru: 'Войти', en: 'Sign in' },
  'booking.login.working': { uz: 'Tekshirilmoqda…', ru: 'Проверяем…', en: 'Checking…' },
  'booking.login.phoneRequired': {
    uz: 'Telefon raqamini toʻliq kiriting.',
    ru: 'Введите номер телефона полностью.',
    en: 'Enter your full phone number.',
  },
  'booking.login.codeRequired': {
    uz: '6 xonali kodni toʻliq kiriting.',
    ru: 'Введите 6-значный код полностью.',
    en: 'Enter the full 6-digit code.',
  },
  'booking.login.failed': { uz: 'Kirishda xatolik.', ru: 'Ошибка входа.', en: 'Sign-in failed.' },
  'booking.patient.required': {
    uz: 'Davom etish uchun navbat kim uchun ekanini tanlang.',
    ru: 'Выберите, для кого запись, чтобы продолжить.',
    en: 'Select who the appointment is for to continue.',
  },
  'booking.confirm.title': { uz: 'Bron maʼlumotlari', ru: 'Данные записи', en: 'Booking details' },
  'booking.confirm.price': { uz: 'Qabul narxi', ru: 'Стоимость приёма', en: 'Consultation fee' },
  'booking.confirm.payAtDesk': {
    uz: 'Qabulxona kassasiga {price} soʻm toʻlaysiz',
    ru: 'Оплата {price} сум — в кассе регистратуры',
    en: 'You will pay {price} UZS at the reception desk',
  },
  'booking.confirm.button': { uz: 'Tasdiqlash', ru: 'Подтвердить', en: 'Confirm' },
  'booking.confirm.working': { uz: 'Band qilinmoqda…', ru: 'Бронируем…', en: 'Booking…' },
  'booking.confirm.note': {
    uz: 'Band qilish uchun Telegram orqali kirgan boʻlishingiz kerak. Bekor qilish yoʻq — qabuldan 1 soat oldingacha vaqtni koʻchirish mumkin.',
    ru: 'Для записи нужно войти через Telegram. Отмены нет — время можно перенести не позднее чем за 1 час до приёма.',
    en: 'You must be signed in via Telegram to book. No cancellation — you can reschedule up to 1 hour before the visit.',
  },
  'booking.success.title': { uz: 'Navbatingiz band qilindi!', ru: 'Вы записаны!', en: 'Your appointment is booked!' },
  'booking.success.telegram': {
    uz: 'Tasdiq Telegram botga yuborildi. Qabulga 1 soat qolganda eslatma keladi.',
    ru: 'Подтверждение отправлено в Telegram-бот. За час до приёма придёт напоминание.',
    en: 'A confirmation was sent to the Telegram bot. You will get a reminder 1 hour before the visit.',
  },

  // --- kabinet menyusi (C1) ---
  'cabinet.menu.appointments': { uz: 'Navbatlarim', ru: 'Мои записи', en: 'My appointments' },
  'cabinet.menu.results': { uz: 'Tahlillarim', ru: 'Мои анализы', en: 'My results' },
  'cabinet.menu.book': { uz: 'Navbat olish', ru: 'Записаться', en: 'Book a visit' },
  'cabinet.menu.settings': { uz: 'Sozlamalar', ru: 'Настройки', en: 'Settings' },
  'cabinet.menu.logout': { uz: 'Chiqish', ru: 'Выйти', en: 'Sign out' },
  'cabinet.menu.login': { uz: 'Kirish', ru: 'Войти', en: 'Sign in' },
  'cabinet.menu.today': { uz: 'Bugungi navbatlar', ru: 'Записи на сегодня', en: 'Today’s appointments' },
  'cabinet.menu.schedule': { uz: 'Jadvalim', ru: 'Моё расписание', en: 'My schedule' },
  'cabinet.menu.dayOff': { uz: 'Ishga chiqa olmayman', ru: 'Не смогу выйти', en: 'Day off' },
  'cabinet.menu.doctors': { uz: 'Shifokorlar', ru: 'Врачи', en: 'Doctors' },
  'cabinet.menu.prices': { uz: 'Narxlar', ru: 'Цены', en: 'Prices' },
  'cabinet.menu.ratings': { uz: 'Baholar', ru: 'Оценки', en: 'Ratings' },

  // --- tahlillar ro'yxati (C2, C3) ---
  'results.mine': { uz: 'Mening tahlillarim', ru: 'Мои анализы', en: 'My results' },
  'results.status.ready': { uz: 'Tayyor', ru: 'Готово', en: 'Ready' },
  'results.status.pending': { uz: 'Kutilmoqda', ru: 'В обработке', en: 'Pending' },
  'results.view': { uz: 'Koʻrish', ru: 'Открыть', en: 'View' },
  'results.count': { uz: '{n} ta koʻrsatkich', ru: '{n} показателей', en: '{n} indicators' },
  'results.empty': {
    uz: 'Hozircha tahlil natijasi yoʻq. Natijalar tayyor boʻlishi bilan shu yerda paydo boʻladi.',
    ru: 'Результатов пока нет. Они появятся здесь, как только будут готовы.',
    en: 'No results yet. They will appear here as soon as they are ready.',
  },

  // --- natija sahifasi (D1, D2) ---
  'result.download': { uz: 'PDF yuklash', ru: 'Скачать PDF', en: 'Download PDF' },
  'result.share': { uz: 'Ulashish', ru: 'Поделиться', en: 'Share' },
  'result.share.copied': {
    uz: 'Havola nusxalandi! Uni messenjer orqali yuborishingiz mumkin.',
    ru: 'Ссылка скопирована! Её можно отправить в мессенджере.',
    en: 'Link copied! You can send it via a messenger.',
  },
  'result.share.failed': {
    uz: 'Havolani nusxalash imkoni boʻlmadi.',
    ru: 'Не удалось скопировать ссылку.',
    en: 'Could not copy the link.',
  },
  'result.patient': { uz: 'Bemorning F.I.Sh.', ru: 'Ф.И.О. пациента', en: 'Patient name' },
  'result.birthGender': { uz: 'Tugʻilgan sanasi / Jinsi', ru: 'Дата рождения / Пол', en: 'Date of birth / Sex' },
  'result.sampleTime': { uz: 'Namuna olingan vaqt', ru: 'Время забора', en: 'Sample time' },
  'result.doctor': { uz: 'Yuborgan shifokor', ru: 'Направивший врач', en: 'Referring doctor' },
  'result.male': { uz: 'Erkak', ru: 'Мужской', en: 'Male' },
  'result.female': { uz: 'Ayol', ru: 'Женский', en: 'Female' },
  'result.age': { uz: '{n} yosh', ru: '{n} лет', en: '{n} y.o.' },
  'result.banner.ok': {
    uz: 'Natijalaringiz tayyor. Barcha koʻrsatkichlar meʼyor doirasida.',
    ru: 'Результаты готовы. Все показатели в пределах нормы.',
    en: 'Your results are ready. All indicators are within the normal range.',
  },
  'result.banner.abnormal': {
    uz: 'Natijalaringiz tayyor. {n} ta koʻrsatkich standart meʼyordan tashqarida.',
    ru: 'Результаты готовы. {n} показателей вне стандартной нормы.',
    en: 'Your results are ready. {n} indicators are outside the standard range.',
  },
  'result.banner.unknown': {
    uz: 'Natijalaringiz tayyor. Meʼyor bilan taqqoslashni shifokoringiz bajaradi.',
    ru: 'Результаты готовы. Сравнение с нормой выполнит ваш врач.',
    en: 'Your results are ready. Your doctor will compare them with the reference ranges.',
  },
  'result.col.name': { uz: 'Tahlil nomi', ru: 'Показатель', en: 'Test' },
  'result.col.value': { uz: 'Natija', ru: 'Результат', en: 'Result' },
  'result.col.status': { uz: 'Status', ru: 'Статус', en: 'Status' },
  'result.col.range': { uz: 'Meʼyoriy oraliq', ru: 'Референсный интервал', en: 'Reference range' },
  'result.col.gauge': { uz: 'Vizual koʻrsatkich', ru: 'Шкала', en: 'Scale' },
  'result.status.normal': { uz: 'Meʼyor', ru: 'Норма', en: 'Normal' },
  'result.status.high': { uz: 'Yuqori', ru: 'Выше', en: 'High' },
  'result.status.low': { uz: 'Past', ru: 'Ниже', en: 'Low' },
  'result.disclaimer': {
    uz: 'Laboratoriya tahlil natijalari faqatgina malakali shifokor tomonidan baholanishi lozim. Meʼyoriy oraliqlar laboratoriya uslubiga qarab farq qilishi mumkin.',
    ru: 'Результаты лабораторных анализов должен оценивать только квалифицированный врач. Референсные интервалы зависят от методики лаборатории.',
    en: 'Laboratory results must be interpreted only by a qualified physician. Reference ranges depend on the laboratory method.',
  },
  'result.important': { uz: 'Muhim eslatma', ru: 'Важно', en: 'Important' },
  'result.footer': {
    uz: 'Dimed klinikasi laboratoriyasining elektron hisoboti. Chinoz, Navoiy koʻchasi 18 · +998 55 9009 103',
    ru: 'Электронный отчёт лаборатории клиники Dimed. Чиназ, ул. Навои 18 · +998 55 9009 103',
    en: 'Electronic report of the Dimed clinic laboratory. Chinoz, Navoiy street 18 · +998 55 9009 103',
  },
  'result.notFound': {
    uz: 'Natija topilmadi yoki havola muddati oʻtgan.',
    ru: 'Результат не найден или срок ссылки истёк.',
    en: 'Result not found or the link has expired.',
  },
  'result.loginToView': {
    uz: 'Natijani koʻrish uchun Telegram orqali kiring.',
    ru: 'Чтобы посмотреть результат, войдите через Telegram.',
    en: 'Sign in via Telegram to view the result.',
  },

  // --- shifokor kartasi: bemor baholari (G2) ---
  'doctor.rating': { uz: '★ {avg} · {n} ta baho', ru: '★ {avg} · {n} оцен.', en: '★ {avg} · {n} ratings' },
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof messages;

/** Matnni tanlangan tilda qaytaradi; {name} joylari `vars` dan to'ldiriladi. */
export function t(key: MessageKey, lang: Lang = 'uz', vars: Record<string, string | number> = {}): string {
  const entry = messages[key] as Entry | undefined;
  const text = entry?.[lang] ?? entry?.uz ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
