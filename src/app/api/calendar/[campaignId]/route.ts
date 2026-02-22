import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign.id },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      title: true,
      date: true,
      sessionNumber: true,
    },
  });

  const icalLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QuiverDM//Sessions//EN',
    `X-WR-CALNAME:${campaign.name} - Sessions`,
    'CALSCALE:GREGORIAN',
    ...sessions.flatMap((session) => {
      const dtStart =
        session.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const summary = `${campaign.name} - Session ${session.sessionNumber}${
        session.title ? `: ${session.title}` : ''
      }`;

      return [
        'BEGIN:VEVENT',
        `UID:quiverdm-session-${session.id}`,
        `DTSTAMP:${dtStart}`,
        `DTSTART:${dtStart}`,
        `SUMMARY:${summary}`,
        'END:VEVENT',
      ];
    }),
    'END:VCALENDAR',
  ];

  return new NextResponse(icalLines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${campaign.name}-sessions.ics"`,
    },
  });
}

