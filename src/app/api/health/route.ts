import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  error?: string;
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  // Read version from package.json — use a fallback if not available
  let version = '0.0.0';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../../../package.json');
    version = pkg.version || version;
  } catch {
    // package.json may not be available in standalone builds
  }

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;

    const response: HealthResponse = {
      status: 'ok',
      timestamp,
      version,
      uptime,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    const response: HealthResponse = {
      status: 'degraded',
      timestamp,
      version,
      uptime,
      error: 'Database unreachable',
    };

    return NextResponse.json(response, { status: 503 });
  }
}
