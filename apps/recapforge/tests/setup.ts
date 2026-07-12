import path from 'path';
import { config } from 'dotenv';

// Root .env carries the live homelab DATABASE_URL, ENCRYPTION_KEY, REDIS_URL.
config({ path: path.resolve(__dirname, '../../../.env') });
