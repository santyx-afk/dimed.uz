/**
 * DynamoDB jadvallarini yaratadi (idempotent — mavjudlarini o'tkazib yuboradi).
 *
 * Ishlatish:
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... npm run create-tables
 */
import {
  DynamoDBClient,
  CreateTableCommand,
  UpdateTimeToLiveCommand,
  UpdateContinuousBackupsCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

import { clientConfig, printTarget, PREFIX as prefix } from './aws-env.mjs';
import { tables } from './tables.mjs';

const client = new DynamoDBClient(clientConfig());
printTarget();

async function exists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

/*
  Zaxira nusxa (PITR) — bemor ma'lumoti bor jadvallarda. Mavjud
  jadvalda ham yoqiladi: skript birinchi marta zaxirasiz ishga
  tushirilgan bo'lishi mumkin, va bu «o'tkazib yuborildi» ostida
  jimgina qolib ketmasligi kerak.
*/
async function enableBackup(TableName) {
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName });
  try {
    await client.send(
      new UpdateContinuousBackupsCommand({
        TableName,
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      }),
    );
    console.log(`  zaxira nusxa yoqildi (35 kun)`);
  } catch (err) {
    // Allaqachon yoqilgan bo'lsa AWS xato qaytaradi — bu muammo emas.
    if (err.name !== 'ContinuousBackupsUnavailableException') throw err;
    console.log(`  zaxira nusxa allaqachon yoqilgan`);
  }
}

for (const table of tables) {
  const TableName = `${prefix}_${table.name}`;

  if (await exists(TableName)) {
    console.log(`= ${TableName} — allaqachon bor, o'tkazib yuborildi`);
    if (table.backup) await enableBackup(TableName);
    continue;
  }

  await client.send(
    new CreateTableCommand({
      TableName,
      AttributeDefinitions: table.attrs,
      KeySchema: table.keys,
      BillingMode: 'PAY_PER_REQUEST',
      ...(table.indexes ? { GlobalSecondaryIndexes: table.indexes } : {}),
    }),
  );
  console.log(`+ ${TableName} yaratildi`);

  if (table.ttlAttribute) {
    await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName });
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName,
        TimeToLiveSpecification: { Enabled: true, AttributeName: table.ttlAttribute },
      }),
    );
    console.log(`  TTL yoqildi: ${table.ttlAttribute}`);
  }

  if (table.backup) await enableBackup(TableName);
}

console.log('\nTayyor.');
