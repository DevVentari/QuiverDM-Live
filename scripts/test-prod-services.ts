import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

async function testServices() {
  console.log("Testing PostgreSQL...");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require'
      }
    }
  });
  
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log("✅ PostgreSQL connected:", result);
  } catch (err: any) {
    if (err instanceof Error) {
        console.error("❌ PostgreSQL connection failed:", err.message);
    } else {
        console.error("❌ PostgreSQL connection failed:", err);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\nTesting Redis (Upstash)...");
  const redis = new Redis('rediss://default:AcIzAAIncDFmZGU0YzNhNGQzZTg0MTM0OTAzMzUyYjkyZjM2YWViMnAxNDk3MTU@concise-ram-49715.upstash.io:6379');
  
  try {
    await redis.ping();
    console.log("✅ Redis connected");
  } catch (err: any) {
     if (err instanceof Error) {
        console.error("❌ Redis connection failed:", err.message);
    } else {
        console.error("❌ Redis connection failed:", err);
    }
  } finally {
    redis.quit();
  }
}

testServices();
