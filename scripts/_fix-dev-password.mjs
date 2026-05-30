import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://quiverdm:localdev@192.168.1.21:5432/quiverdm' } },
});

const hash = await bcrypt.hash('Dev123!', 10);
console.log('New hash:', hash);

const result = await prisma.account.updateMany({
  where: { userId: 'cmp2jbjre02hq1f9kqbz4aary', provider: 'credentials' },
  data: { password: hash },
});
console.log('Updated rows:', result.count);

const check = await prisma.account.findFirst({
  where: { userId: 'cmp2jbjre02hq1f9kqbz4aary', provider: 'credentials' },
});
const ok = await bcrypt.compare('Dev123!', check.password);
console.log('Verify:', ok);

await prisma.$disconnect();
