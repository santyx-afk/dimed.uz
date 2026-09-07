/**
 * `html2pdf.js` o'zining tip ta'rifini bermaydi va `@types/...` paketi
 * ham yo'q. Bizga kerak bo'lgan zanjir — `html2pdf().set(...).from(el).save()`.
 * Natija sahifasi (`src/pages/natija.astro`) shu qadar ishlatadi.
 */
declare module 'html2pdf.js' {
  type Worker = {
    set(options: Record<string, unknown>): Worker;
    from(element: HTMLElement): Worker;
    save(): Promise<void>;
  };
  const html2pdf: () => Worker;
  export default html2pdf;
}
