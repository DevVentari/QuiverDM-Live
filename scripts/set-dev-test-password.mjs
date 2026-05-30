import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const user = await prisma.user.findUnique({ where: { email: 'dev@blakewales.au' }, select: { id: true } })
console.log('user:', user?.id)
const res = await prisma.account.updateMany({
  where: { userId: user.id, provider: 'credentials' },
  data: { password: '$2b$10$8WSdFAPHzfWvH3PvQEAS5eC7ZmAHzehRcDge2GISQ3lClLVlVH.7e' },
})
console.log('updated:', res.count)
await prisma.$disconnect()
