import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const ENCRYPTION_KEY = '3nG9+8WZtOXv8SI758zIFQAJ1GE57gEL7eZH9uOLQUA=';

function decrypt(text: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const p = new PrismaClient({ datasources: { db: { url: DB } } });
(async () => {
  const settings = await p.userSettings.findMany({
    where: { dndBeyondCobaltCookie: { not: null } },
    select: { userId: true, dndBeyondCobaltCookie: true },
  });
  console.log(`Found ${settings.length} users with CobaltSession`);
  for (const s of settings) {
    try {
      const session = decrypt(s.dndBeyondCobaltCookie!);
      console.log(`userId=${s.userId}, session=${session.slice(0, 40)}... (${session.length} chars)`);
    } catch(e) {
      console.log(`userId=${s.userId}, decrypt failed: ${(e as Error).message}`);
    }
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
