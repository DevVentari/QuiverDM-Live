import { describe, expect, it } from 'vitest';
import { dedupeMapBackgroundCandidates, isMapBackgroundCandidate } from '@/lib/map-background-sources';

describe('map-background-sources', () => {
  it('treats LMOP-style cave and hideout art as map candidates even when the tag is not map', () => {
    expect(
      isMapBackgroundCandidate({
        id: '1',
        url: 'https://example.com/cragmaw-hideout.png',
        kind: 'scene',
        sectionHeading: 'Cragmaw Hideout',
      }),
    ).toBe(true);

    expect(
      isMapBackgroundCandidate({
        id: '2',
        url: 'https://example.com/wave-echo-cave.png',
        kind: 'generic',
        alt: 'Wave Echo Cave',
      }),
    ).toBe(true);
  });

  it('excludes obvious portrait imagery', () => {
    expect(
      isMapBackgroundCandidate({
        id: '3',
        url: 'https://example.com/nezznar-portrait.png',
        kind: 'portrait',
        alt: 'Nezznar portrait',
      }),
    ).toBe(false);
  });

  it('deduplicates by URL after filtering', () => {
    const deduped = dedupeMapBackgroundCandidates([
      {
        id: '4',
        url: 'https://example.com/phandalin-map.png',
        kind: 'generic',
        alt: 'Phandalin map',
      },
      {
        id: '5',
        url: 'https://example.com/phandalin-map.png',
        kind: 'scene',
        sectionHeading: 'Phandalin',
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe('4');
  });
});
