import { t } from '../data/i18n';
import { getLang } from './lang';

/**
 * Mehmon paneli (SignInCard) bilan ishlash.
 *
 * 401 — kirish kerak: panel o'zgarishsiz ko'rsatiladi.
 * 403 — kirgan, lekin huquqi yo'q: kirish tugmalari o'rniga sabab
 * yoziladi, aks holda odam qayta-qayta kirib, o'sha devorga urilaveradi.
 */
export function showSignIn(status: number, note?: string, panelId = 'guest'): void {
  const loading = document.getElementById('loading');
  const panel = document.getElementById(panelId);
  if (!panel) return;

  if (loading) loading.hidden = true;
  panel.hidden = false;
  // Mehmonga kabinet tablari kerak emas — hammasi shu devorga olib boradi.
  document.querySelector('[data-cabinet-tabs]')?.setAttribute('hidden', '');

  if (status === 403) {
    // Kirgan odamga "kiring" deyish ma'nosiz — sarlavha ham, tugmalar ham o'zgaradi.
    const title = panel.querySelector('h2');
    if (title) title.textContent = t('signin.denied.title', getLang());
    panel.querySelectorAll<HTMLElement>('.signin-btns, .signin-steps').forEach((el) => {
      el.hidden = true;
    });
    const box = panel.querySelector<HTMLElement>('[data-signin-note]');
    if (box && note) {
      box.hidden = false;
      box.textContent = note;
    }
  }
}

/** Panel ichidagi "shu sahifada nima ochiladi" matnini almashtiradi. */
export function setSignInWhat(text: string, panelId = 'guest'): void {
  const box = document.getElementById(panelId)?.querySelector<HTMLElement>('[data-signin-what]');
  if (box) box.textContent = text;
}
