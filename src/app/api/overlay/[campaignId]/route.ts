import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      async function sendState() {
        try {
          const activeSession = await prisma.gameSession.findFirst({
            where: {
              campaignId,
              status: 'in_progress',
            },
            orderBy: {
              updatedAt: 'desc',
            },
            select: {
              id: true,
              title: true,
              sessionNumber: true,
            },
          });

          const payload = {
            sessionActive: !!activeSession,
            sessionId: activeSession?.id,
            sessionTitle: activeSession?.title,
            sessionNumber: activeSession?.sessionNumber,
            encounter: null,
            timestamp: Date.now(),
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Keep stream alive. Client auto-reconnect handles transient failures.
        }
      }

      await sendState();
      const interval = setInterval(sendState, 2000);

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
      'Access-Control-Allow-Origin': '*',
    },
  });
}

