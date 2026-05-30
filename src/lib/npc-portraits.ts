/**
 * Curated portrait map for well-known NPCs.
 * Generated via Higgsfield nano_banana_2 (2026-05-16).
 *
 * resolvePortrait(name) returns a CDN URL when we have a hand-crafted portrait
 * for that NPC, or null if none. Applied during DDB sourcebook sync so every
 * campaign gets portraits automatically on first import.
 */

interface PortraitEntry {
  patterns: string[];
  exclude?: string[];
  imageUrl: string;
}

const PORTRAITS: PortraitEntry[] = [
  {
    // Strahd, Count Strahd von Zarovich, Strahd von Zarovich
    patterns: ['strahd'],
    exclude: ['zombie', 'spies', 'zarovichin i'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142648_e4cdd021-f1ee-4710-ac5d-48391a0ed94d.png',
  },
  {
    patterns: ['madam eva'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142653_b16191a3-1cb0-4bcf-9e2a-11d17dfaa4fe.png',
  },
  {
    patterns: ['ireena'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142658_3f86bf0f-6ad0-48dc-81ea-fa7ddc7660fc.png',
  },
  {
    // Van Richten, Rudolph van Richten, Rictavio (Dr. Rudolph van Richten)
    patterns: ['van richten', 'rictavio'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142703_6524bf71-93ed-48c5-9ca9-bd554a33c830.png',
  },
  {
    patterns: ['rahadin'],
    imageUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_3C9GY7YOxZjoeAnBDJMnyLXBsET/hf_20260516_142709_e01a9fd5-5c77-4901-8c46-64ebe63227ac.png',
  },
];

export function resolvePortrait(name: string): string | null {
  const lower = name.toLowerCase();
  for (const entry of PORTRAITS) {
    const excluded = entry.exclude?.some((ex) => lower.includes(ex)) ?? false;
    if (excluded) continue;
    const matched = entry.patterns.some((p) => lower.includes(p));
    if (matched) return entry.imageUrl;
  }
  return null;
}
