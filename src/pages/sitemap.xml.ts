import type { APIRoute } from 'astro';

/**
 * Ochiq sahifalar. Kabinet, kirish, admin va natija sahifalari bu
 * yerga kirmaydi (robots.txt ularni yopadi). Ro'yxat qo'lda: sayt
 * statik yig'iladi va ochiq sahifalar bir qo'l barmog'ida sanaladi.
 */
const pages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/tahlillar', priority: '0.8', changefreq: 'weekly' },
  { path: '/maxfiylik', priority: '0.3', changefreq: 'yearly' },
];

// Build vaqti — sayt har deploy'da qayta yig'iladi.
const lastmod = new Date().toISOString().slice(0, 10);

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://dimed.uz');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${new URL(p.path, base).href}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
