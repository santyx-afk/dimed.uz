/**
 * src/data/doctors.ts dagi shifokorlarni DynamoDB'ga yozadi.
 * Qayta ishga tushirish xavfsiz: mavjud shifokorning jadvali va narxi
 * yangilanadi, telegram_id esa tegilmaydi (uni admin bog'laydi).
 *
 * Ishlatish: npm run seed-doctors
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { clientConfig, printTarget, explainMissingTable, PREFIX as prefix } from './aws-env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const table = `${prefix}_doctors`;

const db = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig()), {
  marshallOptions: { removeUndefinedValues: true },
});
printTarget();

// doctors.ts to'g'ridan-to'g'ri o'qiladi (node --experimental-strip-types).
const { doctors } = await import(pathToFileURL(join(root, 'src', 'data', 'doctors.ts')).href);

const explain = explainMissingTable(table);

for (const d of doctors) {
  await db.send(
    new UpdateCommand({
      TableName: table,
      Key: { doctor_id: d.id },
      // telegram_id bu yerda yozilmaydi — u qo'lda bog'lanadi va
      // qayta seed qilishda o'chib ketmasligi kerak.
      UpdateExpression: `SET #n = :name, job = :job, dept_id = :dept, shifts = :shifts,
        slot_minutes = :slot, workdays = :workdays, price = :price, active = :active,
        photo = :photo, experience = :exp, hours = :hours, updated_at = :updated`,
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: {
        ':name': d.name,
        ':job': d.job,
        ':dept': d.deptId,
        ':shifts': d.shifts,
        ':slot': d.slotMinutes,
        ':workdays': d.workdays,
        ':price': d.price,
        // Faolsiz shifokor (doctors.ts da active:false) qayta seed'da ham yoqilib ketmaydi.
        ':active': d.active !== false,
        ':photo': d.photo,
        ':exp': d.experience ?? '',
        ':hours': d.hours,
        ':updated': new Date().toISOString(),
      },
    }),
  ).catch(explain);
  console.log(`+ ${d.id} — ${d.name}`);
}

console.log(`\n${doctors.length} ta shifokor ${table} jadvaliga yozildi.`);
console.log('Eslatma: shifokor kabinetiga kirishi uchun telegram_id ni qo\'lda bog\'lang.');
