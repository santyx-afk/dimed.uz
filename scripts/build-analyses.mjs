/**
 * legacy/_analysis/*.md front-matter va legacy/_data/price.csv dan
 * src/data/analyses.json hosil qiladi.
 *
 * Ishlatish: npm run build-analyses
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const analysisDir = join(root, 'legacy', '_analysis');
const priceCsv = join(root, 'legacy', '_data', 'price.csv');
const outFile = join(root, 'src', 'data', 'analyses.json');

const prices = new Map();
for (const line of readFileSync(priceCsv, 'utf8').split('\n').slice(1)) {
  const [code, price] = line.split(',');
  if (code?.trim()) prices.set(code.trim(), price.trim());
}

const field = (fm, name) => fm.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';

const items = [];
for (const file of readdirSync(analysisDir)) {
  if (!file.endsWith('.md')) continue;
  const fm = readFileSync(join(analysisDir, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!fm) continue;

  const code = field(fm, 'code');
  const title = field(fm, 'title');
  if (!code || !title) continue;

  items.push({
    code,
    title,
    group: field(fm, 'group'),
    duration: field(fm, 'duration'),
    price: prices.get(code) ?? '',
  });
}

items.sort((a, b) => a.group.localeCompare(b.group, 'uz') || a.title.localeCompare(b.title, 'uz'));

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(items, null, 2) + '\n');

const missing = items.filter((i) => !i.price).length;
console.log(`${items.length} ta tahlil yozildi -> src/data/analyses.json`);
if (missing) console.warn(`Diqqat: ${missing} ta tahlilda narx yo'q (price.csv da kod topilmadi)`);
