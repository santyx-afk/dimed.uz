import type { APIRoute } from 'astro';

/** Ochiq sahifalar. Kabinet va kirish bu yerga kirmaydi. */
const pages = [
  { path: '/', priority: '1.0' },
  { path: '/tahlillar', priority: '0.8' },
];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://dimed.uz');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${new URL(p.path, base).href}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
