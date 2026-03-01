/**
 * One-time setup: configure CORS on the R2 bucket to allow direct browser uploads.
 * Run with: npm run setup:r2-cors
 */
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function setupCors() {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [
              'https://quiverdm.com',
              'https://app.nerdt.au',
              'https://*.vercel.app',
              'http://localhost:3847',
            ],
            AllowedMethods: ['PUT'],
            AllowedHeaders: ['Content-Type', 'Content-Length'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log('R2 CORS configured successfully.');
}

setupCors().catch((err) => {
  console.error('Failed to configure R2 CORS:', err.message);
  process.exit(1);
});
