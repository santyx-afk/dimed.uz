/**
 * Skriptlar uchun AWS sozlamasi — `netlify/functions/lib/env.ts` dagi
 * bilan bir xil qoida, shunda lokal va serverdagi nomlar farq qilmaydi.
 *
 * Kalitlar `DIMED_AWS_ACCESS_KEY_ID` / `DIMED_AWS_SECRET_ACCESS_KEY`
 * yoki standart `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` dan
 * o'qiladi. Ikkalasi ham yo'q bo'lsa umuman berilmaydi — shunda SDK
 * o'zining odatdagi zanjiriga tayanadi (CloudShell, IAM rol,
 * ~/.aws/credentials).
 */
export const REGION = process.env.DIMED_AWS_REGION ?? 'eu-central-1';
export const PREFIX = process.env.DIMED_TABLE_PREFIX ?? 'dimed';

const accessKeyId = process.env.DIMED_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.DIMED_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

/** DynamoDBClient ga beriladigan sozlama. */
export function clientConfig() {
  return {
    region: REGION,
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    // Testlarda lokal soxta DynamoDB ishlatiladi.
    ...(process.env.DIMED_DYNAMO_ENDPOINT ? { endpoint: process.env.DIMED_DYNAMO_ENDPOINT } : {}),
  };
}

/** Ishga tushganda qaysi region va jadval prefiksi ishlatilayotganini aytadi. */
export function printTarget() {
  console.log(`Region: ${REGION} · jadval prefiksi: ${PREFIX}_\n`);
}

/**
 * DynamoDB "ResourceNotFoundException" ni quruq qaytaradi. Sababi
 * deyarli har doim ikkitadan biri: jadval yaratilmagan yoki region
 * boshqa. Xatoni shu maslahat bilan almashtiramiz, qolganini o'tkazib
 * yuboramiz.
 *
 * Ishlatish: `await db.send(...).catch(explainMissingTable(table))`
 */
export const explainMissingTable = (table) => (err) => {
  if (err?.name !== 'ResourceNotFoundException') throw err;

  console.error(`\nXato: "${table}" jadvali topilmadi (region: ${REGION}).\n`);
  console.error('Ikki sababdan biri:');
  console.error('  1. Jadvallar hali yaratilmagan. Avval shuni yurgizing:');
  console.error('       node scripts/create-tables.mjs\n');
  console.error('  2. Region mos kelmayapti — jadvallar boshqa regionda yaratilgan.');
  console.error(`     Hozir ishlatilgani: ${REGION}`);
  console.error("     Netlify'dagi DIMED_AWS_REGION bilan bir xil bo'lishi kerak.");
  console.error('     Boshqasini ko\'rsatish uchun (PowerShell):');
  console.error('       $env:DIMED_AWS_REGION="us-east-1"');
  process.exit(1);
};
