const FREE_LIMIT = 2000;
const SUB_LIMIT = 4000;

export async function postSummaryToDiscord(
  webhookUrl: string,
  sessionTitle: string,
  summary: string,
  isSubscribed: boolean
): Promise<void> {
  const limit = isSubscribed ? SUB_LIMIT : FREE_LIMIT;
  const header = `**${sessionTitle}**\n`;
  const available = limit - header.length;
  const body = summary.length > available ? summary.slice(0, available - 1) + '…' : summary;

  const messages: string[] = [];

  if (isSubscribed && body.length > FREE_LIMIT - header.length) {
    const firstChunk = body.slice(0, FREE_LIMIT - header.length);
    const secondChunk = body.slice(FREE_LIMIT - header.length);
    messages.push(header + firstChunk);
    if (secondChunk) messages.push(secondChunk);
  } else {
    messages.push(header + body);
  }

  for (const content of messages) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
    }
  }
}
