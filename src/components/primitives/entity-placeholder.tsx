'use client'

type Tone = 'amber' | 'arcane' | 'quest' | 'danger' | 'neutral'

const TONE_STYLES: Record<Tone, { color: string; bg: string }> = {
  amber:   { color: 'var(--q-accent-primary)', bg: 'var(--q-accent-primary-trace)' },
  arcane:  { color: 'var(--q-accent-arcane)',  bg: 'var(--q-accent-arcane-trace)' },
  quest:   { color: 'var(--q-accent-quest)',   bg: 'var(--q-accent-quest-trace)' },
  danger:  { color: 'var(--q-accent-danger)',  bg: 'var(--q-accent-danger-trace)' },
  neutral: { color: 'var(--q-text-dim)',        bg: 'transparent' },
}

export type PlaceholderEntityType =
  | 'npc' | 'pc' | 'monster' | 'location' | 'item' | 'spell'
  | 'faction' | 'sourcebook' | 'weapon' | 'secret' | 'tarot' | 'custom'
  | 'event' | 'threat' | 'arc' | 'note' | 'encounter'

const TYPE_MAP: Record<PlaceholderEntityType, { src: string; tone: Tone }> = {
  npc:        { src: '/icons/dnd/entity/person.svg',        tone: 'amber' },
  pc:         { src: '/icons/dnd/entity/person.svg',        tone: 'amber' },
  monster:    { src: '/icons/dnd/monster/humanoid.svg',     tone: 'danger' },
  location:   { src: '/icons/dnd/location/dungeon.svg',     tone: 'quest' },
  item:       { src: '/icons/dnd/entity/magic-item.svg',    tone: 'arcane' },
  spell:      { src: '/icons/dnd/spell/evocation.svg',      tone: 'arcane' },
  faction:    { src: '/icons/dnd/entity/organization.svg',  tone: 'neutral' },
  sourcebook: { src: '/icons/dnd/entity/book.svg',          tone: 'amber' },
  weapon:     { src: '/icons/dnd/entity/weapon.svg',        tone: 'neutral' },
  secret:     { src: '/icons/dnd/entity/archive.svg',       tone: 'neutral' },
  tarot:      { src: '/icons/dnd/spell/octagon.svg',        tone: 'arcane' },
  custom:     { src: '/icons/dnd/game/dm.svg',              tone: 'amber' },
  event:      { src: '/icons/dnd/game/combat.svg',          tone: 'amber' },
  threat:     { src: '/icons/dnd/game/hazard.svg',          tone: 'danger' },
  arc:        { src: '/icons/dnd/game/adventure-book.svg',  tone: 'arcane' },
  note:       { src: '/icons/dnd/entity/scroll.svg',        tone: 'neutral' },
  encounter:  { src: '/icons/dnd/game/combat.svg',          tone: 'danger' },
}

export function EntityPlaceholder({
  type,
  src: srcOverride,
  tone: toneOverride,
  size = 48,
}: {
  type?: PlaceholderEntityType
  src?: string
  tone?: Tone
  size?: number
}) {
  const resolved = type ? TYPE_MAP[type] : undefined
  const src = srcOverride ?? resolved?.src ?? '/icons/dnd/entity/person.svg'
  const tone = toneOverride ?? resolved?.tone ?? 'neutral'
  const { color, bg } = TONE_STYLES[tone]

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 50% 65%, ${bg} 0%, transparent 70%)`,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'block',
          width: size,
          height: size,
          backgroundColor: color,
          opacity: 0.8,
          maskImage: `url(${src})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskImage: `url(${src})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
        }}
      />
    </div>
  )
}
