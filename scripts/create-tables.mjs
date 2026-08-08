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

const region = process.env.DIMED_AWS_REGION ?? 'eu-central-1';
const prefix = process.env.DIMED_TABLE_PREFIX ?? 'dimed';
const client = new DynamoDBClient({ region });

const S = (name) => ({ AttributeName: name, AttributeType: 'S' });
const HASH = (name) => ({ AttributeName: name, KeyType: 'HASH' });
const RANGE = (name) => ({ AttributeName: name, KeyType: 'RANGE' });

/** Har bir jadval: bepul chegarada qolish uchun PAY_PER_REQUEST. */
const tables = [
  {
    name: 'users',
    attrs: [S('telegram_id'), S('phone')],
    keys: [HASH('telegram_id')],
    indexes: [{ IndexName: 'phone-index', KeySchema: [HASH('phone')], Projection: { ProjectionType: 'ALL' } }],
  },
  {
    name: 'otp_codes',
    attrs: [S('phone')],
    keys: [HASH('phone')],
    ttlAttribute: 'expires_at',
  },
  {
    // telegram-index: shifokor o'z kabinetiga Telegram orqali kiradi
    name: 'doctors',
    attrs: [S('doctor_id'), S('telegram_id')],
    keys: [HASH('doctor_id')],
    indexes: [
      {
        IndexName: 'telegram-index',
        KeySchema: [HASH('telegram_id')],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    // PK: doctor_id, SK: sana — bir shifokorning kunlik smenalari
    name: 'schedules',
    attrs: [S('doctor_id'), S('date')],
    keys: [HASH('doctor_id'), RANGE('date')],
  },
  {
    // PK: "doctor_id#sana", SK: vaqt — slot bandligini atomik tekshirish uchun
    name: 'appointments',
    attrs: [S('doctor_day'), S('time'), S('phone'), S('starts_at')],
    keys: [HASH('doctor_day'), RANGE('time')],
    indexes: [
      {
        IndexName: 'patient-index',
        KeySchema: [HASH('phone'), RANGE('starts_at')],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        // date-index: eslatma va kunlik xulosa cron'lari uchun — ular
        // butun klinika bo'yicha "shu kundagi navbatlar" ni so'raydi
        IndexName: 'date-index',
        KeySchema: [HASH('date'), RANGE('starts_at')],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    name: 'payments',
    attrs: [S('payment_id')],
    keys: [HASH('payment_id')],
  },
  {
    // PK: bemor telefoni, SK: "sana#kod"
    name: 'lab_results',
    attrs: [S('phone'), S('sort_key')],
    keys: [HASH('phone'), RANGE('sort_key')],
  },
];

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
