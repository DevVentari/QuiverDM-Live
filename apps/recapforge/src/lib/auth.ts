import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const providers = [];

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    })
  );
}

providers.push(
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = z
        .object({ email: z.string().email(), password: z.string().min(8) })
        .safeParse(credentials);
      if (!parsed.success) return null;

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;

      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: 'credentials' },
      });
      if (!account?.password) return null;

      const ok = await bcrypt.compare(password, account.password);
      if (!ok) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  })
);

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || undefined;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/signin', error: '/auth/error' },
  ...(cookieDomain
    ? {
        cookies: {
          sessionToken: {
            name: '__Secure-authjs.session-token',
            options: {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              secure: true,
              domain: cookieDomain,
            },
          },
        },
      }
    : {}),
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
