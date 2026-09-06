/**
 * Sahifaga tushganda `.rv` bloklarini ochadi (ko'rinish animatsiyasi).
 *
 * Base.astro ichida inline `<script>` edi. Alohida modulga chiqarildi:
 * shunda sahifada birorta ham inline skript qolmaydi va CSP'da
 * `script-src 'self'` yozish mumkin — `'unsafe-inline'` siz.
 */
export function revealOnScroll(root: ParentNode = document): void {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  root.querySelectorAll('.rv').forEach((el) => io.observe(el));
}
