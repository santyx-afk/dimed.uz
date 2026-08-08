import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AWS_REGION, tableName } from './env.ts';

const client = new DynamoDBClient({ region: AWS_REGION });

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLES = {
  users: tableName('users'),
  otpCodes: tableName('otp_codes'),
  doctors: tableName('doctors'),
  schedules: tableName('schedules'),
  appointments: tableName('appointments'),
  payments: tableName('payments'),
  labResults: tableName('lab_results'),
} as const;
