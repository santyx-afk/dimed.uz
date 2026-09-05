/**
 * Brauzerdagi til tanlovi (uz / ru / en).
 *
 * Tartib: `?lang=` parametri → localStorage (`dimed_lang`) → sahifa
 * `<html lang>` → uz. Tanlov localStorage'da eslab qolinadi, shuning
 * uchun bot havolasidan `?lang=ru` bilan kelgan bemor keyingi
 * sahifalarda ham ruscha ko'radi.
 */
import { isLang, type Lang } from '../data/i18n';

const KEY = 'dimed_lang';

export function getLang(): Lang {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (isLang(fromUrl)) {
      localStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* localStorage yopiq bo'lishi mumkin (maxfiy rejim) — uz qoladi */
  }
  const fromHtml = document.documentElement.lang;
  return isLang(fromHtml) ? fromHtml : 'uz';
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* saqlanmasa ham joriy sahifada ishlaydi */
  }
  document.documentElement.lang = lang;
}

/**
 * Sahifadagi `[data-lang]` bloklardan faqat tanlangan tilnikini
 * ko'rsatadi va `[data-lang-pick]` tugmalarni belgilaydi. Tarjimasi
 * bo'lmagan blok (faqat uz) doim ko'rinadi.
 */
export function applyLang(lang: Lang, root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-lang]').forEach((el) => {
    el.hidden = el.dataset.lang !== lang;
  });
  root.querySelectorAll<HTMLElement>('[data-lang-pick]').forEach((btn) => {
    const on = btn.dataset.langPick === lang;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/** Til tugmalarini ulaydi: bosilganda saqlaydi va bloklarni almashtiradi. */
export function bindLangSwitch(root: ParentNode = document, onChange?: (lang: Lang) => void): Lang {
  const current = getLang();
  applyLang(current, root);
  root.querySelectorAll<HTMLElement>('[data-lang-pick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.langPick;
      if (!isLang(lang)) return;
      setLang(lang);
      applyLang(lang, root);
      onChange?.(lang);
    });
  });
  return current;
}
