'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Heart, Shield, Zap, Star, X } from 'lucide-react';

type HitPoints = { current: number; max: number; temp?: number };

type HeroStatBarProps = {
  hp: HitPoints | null;
  armorClass: number | null;
  speed: number | null;
  proficiencyBonus: number | null;
  isUpdating?: boolean;
  onUpdateHp?: (next: HitPoints) => Promise<void>;
};

export function HeroStatBar({
  hp,
  armorClass,
  speed,
  proficiencyBonus,
  isUpdating,
  onUpdateHp,
}: HeroStatBarProps) {
  const max = hp?.max ?? 0;
  const [localHp, setLocalHp] = useState(hp?.current ?? 0);
  const [delta, setDelta] = useState(0);
  const dirtyRef = useRef(false);
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(isUpdating ?? false);
  const hpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isUpdatingRef.current = isUpdating ?? false;
  }, [isUpdating]);

  // Sync from server when not actively editing
  useEffect(() => {
    if (!dirtyRef.current && hp != null) {
      setLocalHp(hp.current);
    }
  }, [hp?.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(
    (nextHp: number) => {
      if (!onUpdateHp || !hp) return;
      pendingRef.current = nextHp;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (pendingRef.current != null) {
          await onUpdateHp({ ...hp, current: pendingRef.current });
        }
        dirtyRef.current = false;
        pendingRef.current = null;
      }, 600);
    },
    [onUpdateHp, hp],
  );

  const adjustHp = useCallback(
    (amount: number) => {
      if (!hp) return;
      dirtyRef.current = true;
      setLocalHp((prev) => {
        const next = Math.min(max, Math.max(0, prev + amount));
        const change = next - prev;
        if (change !== 0) {
          setDelta((d) => d + change);
          scheduleSave(next);
        }
        return next;
      });
    },
    [hp, max, scheduleSave],
  );

  // Non-passive wheel handler so we can call preventDefault
  useEffect(() => {
    const el = hpRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (isUpdatingRef.current) return;
      adjustHp(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [adjustHp]);

  const hpPct = max > 0 ? localHp / max : 0;
  const hpColor =
    localHp === 0
      ? 'text-red-500'
      : hpPct <= 0.25
        ? 'text-red-400'
        : hpPct <= 0.5
          ? 'text-yellow-400'
          : 'text-foreground';

  const hasStats = armorClass != null || speed != null || proficiencyBonus != null;

  return (
    <div className="flex items-center gap-3 flex-wrap shrink-0">
      {hp != null && (
        <div className="flex items-center gap-1.5">
          <Heart
            className="h-4 w-4 text-red-500 shrink-0"
            fill="currentColor"
            strokeWidth={0}
          />
          <div
            ref={hpRef}
            className="flex items-baseline gap-0.5 cursor-ns-resize select-none"
            title="Scroll up/down to adjust HP"
          >
            <span className={`text-2xl font-bold tabular-nums leading-none ${hpColor}`}>
              {localHp}
            </span>
            <span className="text-muted-foreground text-sm leading-none">/{max}</span>
            {(hp.temp ?? 0) > 0 && (
              <span className="text-blue-400 text-xs ml-0.5">+{hp.temp}</span>
            )}
          </div>
          {delta !== 0 && (
            <div className="flex items-center gap-0.5 ml-0.5">
              <span
                className={`text-xs font-semibold tabular-nums ${
                  delta < 0 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {delta > 0 ? `+${delta}` : `${delta}`}
              </span>
              <button
                type="button"
                onClick={() => setDelta(0)}
                className="h-3.5 w-3.5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground"
                title="Reset delta"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {hp != null && hasStats && <div className="h-5 w-px bg-border" />}

      {armorClass != null && (
        <div className="flex items-center gap-1">
          <Shield
            className="h-3.5 w-3.5 text-blue-400 shrink-0"
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="text-xl font-bold tabular-nums leading-none">{armorClass}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground self-end mb-px">
            AC
          </span>
        </div>
      )}

      {speed != null && (
        <div className="flex items-center gap-1">
          <Zap
            className="h-3.5 w-3.5 text-yellow-500 shrink-0"
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="text-xl font-bold tabular-nums leading-none">{speed}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground self-end mb-px">
            ft
          </span>
        </div>
      )}

      {proficiencyBonus != null && (
        <div className="flex items-center gap-1">
          <Star
            className="h-3.5 w-3.5 text-amber-400 shrink-0"
            fill="currentColor"
            strokeWidth={0}
          />
          <span className="text-xl font-bold tabular-nums leading-none">+{proficiencyBonus}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground self-end mb-px">
            Prof
          </span>
        </div>
      )}
    </div>
  );
}
