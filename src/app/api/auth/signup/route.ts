import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { inviteService } from '@/server/services/invite.service';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Force Node.js runtime for bcrypt and Prisma support
export const runtime = 'nodejs';
export const maxDuration = 60;

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, inviteCode } = signupSchema.parse(body);
    const normalizedInviteCode = inviteService.normalizeCode(inviteCode);

    try {
      await inviteService.validateCode(normalizedInviteCode);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and credentials account in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          emailVerified: new Date(), // Auto-verify for simplicity
          inviteCodeUsed: normalizedInviteCode,
        },
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: newUser.id,
          password: hashedPassword,
        },
      });

      // Mark invite code as used
      await tx.inviteCode.update({
        where: { code: normalizedInviteCode },
        data: {
          usedBy: newUser.id,
          usedAt: new Date(),
        },
      });

      return newUser;
    });

    // Send welcome email asynchronously; do not fail signup if email delivery fails.
    if (user.email) {
      emailService.sendWelcomeEmail({
        to: user.email,
        name: user.name,
      }).catch((emailError) => {
        console.error('Welcome email failed:', emailError);
      });
    }

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    console.error('Signup error:', {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    });

    // In development, include error details for debugging
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { error: 'Internal server error', details: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
