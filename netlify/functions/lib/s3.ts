import { S3Client } from '@aws-sdk/client-s3';
import { AWS_REGION, awsCredentials } from './env.ts';

/*
  Tahlil PDF fayllari uchun S3. Kalitlar `lib/env.ts` orqali olinadi —
  Netlify standart AWS_* nomlarini band qilgani uchun ular DIMED_
  prefiksi bilan yoziladi (izohi o'sha faylda).
*/
const credentials = awsCredentials();

export const s3 = new S3Client({
  region: AWS_REGION,
  ...(credentials ? { credentials } : {}),
});
