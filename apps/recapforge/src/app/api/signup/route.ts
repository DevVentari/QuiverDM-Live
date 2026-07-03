import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid signup details' }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { email, name },
    });

    await tx.account.create({
      data: {
        userId: newUser.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: newUser.id,
        password: hash,
      },
    });

    return newUser;
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
