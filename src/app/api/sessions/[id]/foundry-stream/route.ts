import { auth } from '@/lib/auth';
import { prisma } from '@/server/db';
import { authz } from '@/server/services/authorization.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatSseData(data: unknown, event?: string) {
  const lines = [];
  if (event) {
    lines.push(`event: ${event}`);
  }
  lines.push(`data: ${JSON.stringify(data)}`);
  return `${lines.join('\n')}\n\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.FOUNDRY_BRIDGE_ENABLED !== 'true') {
    return new Response('Foundry bridge disabled', { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: sessionId } = await params;
  await authz.session(sessionId, session.user.id).verify();

  const encoder = new TextEncoder();
  let lastSeen = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      const publish = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      publish(formatSseData({ ok: true, sessionId }, 'ready'));

      const interval = setInterval(async () => {
        try {
          const events = await prisma.foundryEvent.findMany({
            where: {
              sessionId,
              createdAt: {
                gt: lastSeen,
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: 100,
          });

          if (events.length > 0) {
            lastSeen = events[events.length - 1].createdAt;
            publish(formatSseData(events, 'foundry_events'));
          } else {
            publish(formatSseData({ ts: Date.now() }, 'heartbeat'));
          }
        } catch {
          publish(formatSseData({ error: 'stream_error' }, 'error'));
        }
      }, 2000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
