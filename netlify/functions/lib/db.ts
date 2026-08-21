import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AWS_REGION, awsCredentials, optional, tableName } from './env.ts';

// Testlarda lokal soxta DynamoDB ishlatiladi.
const endpoint = optional('DIMED_DYNAMO_ENDPOINT');
const credentials = awsCredentials();

const client = new DynamoDBClient({
  region: AWS_REGION,
  ...(endpoint ? { endpoint } : {}),
  ...(credentials ? { credentials } : {}),
});

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLES = {
  users: tableName('users'),
  otpCodes: tableName('otp_codes'),
  individuals: tableName('individuals'),
  analysisResults: tableName('analysis_results'),
  doctors: tableName('doctors'),
  schedules: tableName('schedules'),
  appointments: tableName('appointments'),
  payments: tableName('payments'),
  labResults: tableName('lab_results'),
} as const;
