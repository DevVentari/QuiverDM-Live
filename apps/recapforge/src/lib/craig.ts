const AUDIO_EXT_RE = /\.(flac|wav|aac|m4a|mp3|ogg|opus|webm)$/i;

export interface ParsedTrack {
  trackNumber: number | null;
  username: string | null;
}

/**
 * Craig names per-speaker tracks like "1-alexdm.flac", "2-jules_0.flac",
 * sometimes zip-prefixed "craig-01-alex_dm.flac". The trailing _<digits> is a
 * Discord discriminator, not part of the username.
 */
export function parseCraigFilename(filename: string): ParsedTrack {
  if (!AUDIO_EXT_RE.test(filename)) return { trackNumber: null, username: null };
  const base = filename.replace(AUDIO_EXT_RE, '').replace(/^craig[-_]/i, '');
  const m = base.match(/^(\d+)[-_](.+)$/);
  if (!m) return { trackNumber: null, username: null };
  const username = m[2].replace(/[-_]\d+$/, '').toLowerCase();
  return { trackNumber: parseInt(m[1], 10), username: username || null };
}
