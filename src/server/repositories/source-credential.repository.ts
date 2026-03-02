import { prisma } from '@/lib/prisma'

export async function upsertSourceCredential(userId: string, source: string, data: Record<string, unknown>) {
  return prisma.sourceCredential.upsert({
    where: { userId_source: { userId, source } },
    create: { userId, source, data },
    update: { data, updatedAt: new Date() },
  })
}

export async function findSourceCredential(userId: string, source: string) {
  return prisma.sourceCredential.findUnique({
    where: { userId_source: { userId, source } },
  })
}

export async function deleteSourceCredential(userId: string, source: string) {
  return prisma.sourceCredential.deleteMany({
    where: { userId, source },
  })
}

export async function listConnectedSources(userId: string) {
  const creds = await prisma.sourceCredential.findMany({
    where: { userId },
    select: { source: true },
  })
  return creds.map((c) => c.source)
}
