import type { APIRoute } from 'astro';

/** Shaxsiy sahifalar va API indekslanmaydi. */
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /kabinet',
      'Disallow: /kirish',
      'Disallow: /api/',
      '',
      `Sitemap: ${new URL('sitemap.xml', site ?? 'https://dimed.uz').href}`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
