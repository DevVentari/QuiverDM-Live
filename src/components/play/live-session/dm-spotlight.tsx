import type { SpotlightContent } from '@/hooks/use-player-session';

export function DmSpotlight({ spotlight }: { spotlight: SpotlightContent | null }) {
  if (!spotlight) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
        <div>
          <p className="text-2xl mb-2 opacity-30">⚔</p>
          <p>Waiting for your DM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-auto">
      {spotlight.type === 'text' && (
        <div className="stone-card p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {String(spotlight.content)}
        </div>
      )}
      {spotlight.type === 'image' && (
        <img src={String(spotlight.content)} alt="DM shared" className="max-w-full rounded-lg" />
      )}
      {spotlight.type === 'statblock' && (
        <div className="stone-card p-4 font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(spotlight.content, null, 2)}
        </div>
      )}
    </div>
  );
}
