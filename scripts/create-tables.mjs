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

for (const table of tables) {
  const TableName = `${prefix}_${table.name}`;

  if (await exists(TableName)) {
    console.log(`= ${TableName} — allaqachon bor, o'tkazib yuborildi`);
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
}

console.log('\nTayyor.');
