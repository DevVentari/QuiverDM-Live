const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.QUIVERDM_DISCORD_BOT_TOKEN;

interface PostRecapOptions {
  channelId: string;
  sessionTitle: string;
  sections: Array<{ title: string; content: string }>;
}

export async function postRecapToChannel(opts: PostRecapOptions): Promise<void> {
  if (!BOT_TOKEN) throw new Error('QUIVERDM_DISCORD_BOT_TOKEN not set');

  const header = `**${opts.sessionTitle} — Session Recap**\n\n`;
  const body = opts.sections
    .map((s) => `**${s.title}**\n${s.content}`)
    .join('\n\n');

  const full = header + body;
  const chunks = splitIntoChunks(full, 2000);

  for (const chunk of chunks) {
    const res = await fetch(`${DISCORD_API}/channels/${opts.channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      throw new Error(`Discord post failed (HTTP ${res.status}). Check that the bot is in your server and has permission to post in that channel.`);
    }
  }
}

function splitIntoChunks(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, limit);
    const lastNewline = slice.lastIndexOf('\n');
    const cut = lastNewline > limit / 2 ? lastNewline : limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return chunks;
}
