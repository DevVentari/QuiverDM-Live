'use client'

import Link from 'next/link'
import {
  BookOpen,
  Bell,
  CalendarDays,
  ChevronRight,
  CirclePlus,
  Compass,
  Dices,
  Flame,
  Home,
  Library,
  Map,
  MapPin,
  MoonStar,
  Package,
  ScrollText,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Users,
  CheckSquare,
} from 'lucide-react'
import { Card, Section } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const railItems: ReadonlyArray<{
  label: string
  icon: typeof Home
  active?: boolean
}> = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Campaigns', icon: ScrollText },
  { label: 'Sessions', icon: CalendarDays },
  { label: 'Locations', icon: MapPin },
  { label: 'NPCs', icon: Users },
  { label: 'Monsters', icon: Skull },
  { label: 'Items', icon: Package },
  { label: 'Maps', icon: Map },
  { label: 'Lore', icon: BookOpen },
  { label: 'Quests', icon: CheckSquare },
  { label: 'Assets', icon: Library },
] as const

const activityItems = [
  { title: 'The Frostpeak Orcs', date: 'May 20, 2025', status: 'Revamped' },
  { title: 'Silverpine Village', date: 'May 19, 2025', status: 'Updated' },
  { title: 'Eldric Thornmoon', date: 'May 18, 2025', status: 'Added' },
  { title: 'The Moonlit Key', date: 'May 17, 2025', status: 'Added' },
  { title: 'Tower of the Obsidian Eye', date: 'May 16, 2025', status: 'Updated' },
] as const

const sessionRows = [
  { number: 17, title: 'Beneath the Black Hollow', date: 'May 10, 2025', duration: '3.5 hrs' },
  { number: 16, title: 'Whispers in the Dark', date: 'Apr 26, 2025', duration: '3 hrs' },
  { number: 15, title: "The Guardian's Warning", date: 'Apr 12, 2025', duration: '3.5 hrs' },
  { number: 14, title: 'Into the Stonewood', date: 'Mar 29, 2025', duration: '3 hrs' },
] as const

const reminderItems = [
  { title: 'Review Tower of the Obsidian Eye', note: 'Notes, traps, and encounters' },
  { title: 'Prepare NPC: Seraphine Dusk', note: 'Motivations and secrets' },
  { title: 'Random Encounter Table', note: 'Create for Shattered Spire' },
] as const

const pillVariants = [
  {
    id: 'a',
    label: 'A · Border-led',
    outer:
      'linear-gradient(90deg, hsl(37 94% 69% / 0.98) 0%, hsl(37 90% 63% / 0.78) 14%, hsl(37 88% 58% / 0.34) 36%, hsl(37 84% 56% / 0.12) 54%, transparent 70%)',
    inner:
      'linear-gradient(90deg, hsl(220 18% 8% / 0.82) 0%, hsl(220 18% 8% / 0.72) 22%, hsl(220 18% 8% / 0.52) 40%, hsl(220 18% 8% / 0.32) 60%, transparent 78%)',
  },
  {
    id: 'b',
    label: 'B · Almost Clear',
    outer:
      'linear-gradient(90deg, hsl(37 96% 70% / 1) 0%, hsl(37 92% 64% / 0.82) 12%, hsl(37 88% 58% / 0.28) 32%, hsl(37 84% 56% / 0.08) 48%, transparent 66%)',
    inner:
      'linear-gradient(90deg, hsl(220 18% 8% / 0.74) 0%, hsl(220 18% 8% / 0.6) 18%, hsl(220 18% 8% / 0.38) 42%, transparent 74%)',
  },
  {
    id: 'c',
    label: 'C · Warmer Amber',
    outer:
      'linear-gradient(90deg, hsl(33 96% 68% / 1) 0%, hsl(34 90% 60% / 0.8) 14%, hsl(35 84% 54% / 0.32) 34%, hsl(35 84% 54% / 0.1) 50%, transparent 70%)',
    inner:
      'linear-gradient(90deg, hsl(220 18% 8% / 0.05) 0%, hsl(220 18% 8% / 0.03) 22%, hsl(220 18% 8% / 0.015) 40%, transparent 60%)',
  },
  {
    id: 'd',
    label: 'D · Longer Border Fade',
    outer:
      'linear-gradient(90deg, hsl(37 94% 69% / 0.98) 0%, hsl(37 90% 63% / 0.72) 18%, hsl(37 88% 58% / 0.3) 42%, hsl(37 84% 56% / 0.11) 60%, transparent 82%)',
    inner:
      'linear-gradient(90deg, hsl(220 18% 8% / 0.78) 0%, hsl(220 18% 8% / 0.64) 26%, hsl(220 18% 8% / 0.4) 56%, transparent 82%)',
  },
  {
    id: 'e',
    label: 'E · Hot Left Edge',
    outer:
      'linear-gradient(90deg, hsl(38 98% 72% / 1) 0%, hsl(37 94% 66% / 0.9) 10%, hsl(37 88% 58% / 0.3) 28%, hsl(37 84% 56% / 0.08) 44%, transparent 68%)',
    inner:
      'linear-gradient(90deg, hsl(220 18% 8% / 0.78) 0%, hsl(220 18% 8% / 0.62) 18%, hsl(220 18% 8% / 0.36) 44%, transparent 72%)',
  },
] as const

function PreviewRailPill({
  label = 'Home',
  outer,
  inner,
}: {
  label?: string
  outer: string
  inner: string
}) {
  return (
    <div
      className="rounded-xl p-px"
      style={{ background: outer, boxShadow: '0 10px 20px -22px hsl(38 92% 58% / 0.28)' }}
    >
      <div
        className="flex min-h-[52px] items-center gap-4 rounded-[11px] px-5 text-sm text-[hsl(37_94%_69%)]"
        style={{ background: inner }}
      >
        <Home size={20} strokeWidth={1.75} className="shrink-0" />
        <span className="font-[var(--q-font-body)] text-[15px]">{label}</span>
      </div>
    </div>
  )
}

function ShellButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-11 items-center gap-2.5 rounded-xl bg-[var(--q-surface-utility)]/85 px-4',
        'text-[13px] text-[var(--q-text-dim)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

function UtilityCircle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full bg-[var(--q-surface-utility)]/80',
        'text-[var(--q-text-faint)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-[var(--q-font-display)] text-[10px] uppercase tracking-[3px] text-[var(--q-amber-dim)]">
      {children}
    </div>
  )
}

export default function HomeShellPreviewPage() {
  return (
    <div className="min-h-dvh bg-[var(--q-bg)] text-[var(--q-text)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          backgroundImage: 'var(--q-body-atmosphere-base), var(--q-body-texture-overlay)',
          backgroundBlendMode: 'normal, normal',
        }}
      />

      <div className="relative mx-auto max-w-[1760px] p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between rounded-xl bg-black/10 px-4 py-3 text-xs text-[var(--q-text-faint)] shadow-sm">
          <span>Design preview for the proposed home shell styling</span>
          <Link href="/" className="text-[var(--q-amber-dim)] hover:text-[var(--q-amber)]">
            Return to app
          </Link>
        </div>

        <div className="mb-5 max-w-[360px] rounded-2xl border border-[var(--q-border-subtle)] bg-black/10 p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            Active Nav Pill Study
          </div>
          <div className="space-y-3">
            {pillVariants.map((variant) => (
              <div key={variant.id} className="space-y-1.5">
                <div className="text-[11px] text-[var(--q-text-faint)]">{variant.label}</div>
                <PreviewRailPill outer={variant.outer} inner={variant.inner} />
              </div>
            ))}
          </div>
        </div>

        <div
          className="overflow-hidden rounded-[22px] border border-[var(--q-border-subtle)] bg-black/10 shadow-2xl"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 10%, hsl(35 80% 55% / 0.04), transparent 18%), radial-gradient(circle at 82% 14%, hsl(220 30% 70% / 0.03), transparent 20%), url('/textures/cartography-bg.webp')",
            backgroundBlendMode: 'screen, screen, normal',
            backgroundPosition: 'left top, right top, left top',
            backgroundSize: 'auto, auto, 1280px auto',
          }}
        >
          <div className="grid min-h-[calc(100dvh-88px)] grid-cols-1 xl:grid-cols-[244px_1fr]">
            <aside className="border-b border-[var(--q-border-subtle)] bg-[var(--q-shell-rail)]/78 xl:border-b-0 xl:border-r">
              <div className="flex h-full flex-col">
                <div className="border-b border-[var(--q-border-subtle)] px-7 py-10">
                  <div className="mb-6 flex justify-center text-[var(--q-amber)]">
                    <Flame size={38} strokeWidth={1.45} />
                  </div>
                  <div className="text-center font-[var(--q-font-display)] text-[2.9rem] leading-none text-[var(--q-text)]">
                    QuiverDM
                  </div>
                  <div className="mt-4 text-center font-[var(--q-font-display)] text-[14px] uppercase tracking-[4px] text-[var(--q-amber-dim)]">
                    V2
                  </div>
                </div>

                <nav className="flex flex-1 flex-col gap-2.5 px-5 py-6">
                  {railItems.map(({ label, icon: Icon, active }) => (
                    <div key={label}>
                      {active ? (
                        <PreviewRailPill outer={pillVariants[3].outer} inner={pillVariants[3].inner} />
                      ) : (
                        <div className="flex min-h-[52px] items-center gap-4 rounded-xl px-5 text-sm text-[var(--q-text-faint)]">
                          <Icon size={20} strokeWidth={1.75} className="shrink-0" />
                          <span className="font-[var(--q-font-body)] text-[15px]">{label}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </nav>

                <div className="px-5 pb-6 pt-4">
                  <div className="mx-4 mb-5 border-t border-[var(--q-border-subtle)]" />
                  <div className="mb-1 flex min-h-[52px] items-center gap-4 rounded-xl px-5 text-[15px] text-[var(--q-text-faint)]">
                    <Settings size={20} strokeWidth={1.75} className="shrink-0" />
                    <span>Settings</span>
                  </div>
                  <div className="flex min-h-[52px] items-center gap-4 rounded-xl px-5 text-[15px] text-[var(--q-text-faint)]">
                    <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 rotate-180" />
                    <span>Collapse</span>
                  </div>
                  <div className="px-5 pt-8 text-[10px] tracking-[2px] text-[var(--q-text-faint)]">
                    QuiverDM v2.0.0
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-col">
              <header className="border-b border-[var(--q-border-subtle)] bg-[var(--q-shell-bar)]/95 px-6 py-5 md:px-8">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center">
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-12 w-full max-w-[27rem] items-center gap-3 rounded-xl bg-[var(--q-surface-utility)]/85 px-5',
                      'text-[15px] text-[var(--q-text-faint)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03),0_12px_28px_-20px_hsl(220_30%_6%_/_0.8)]',
                    )}
                  >
                    <Sparkles size={16} className="text-[var(--q-text-faint)]" strokeWidth={1.8} />
                    <span className="flex-1 text-left">Search everything...</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2.5 py-1 text-[11px] text-[var(--q-text-faint)]">
                      <span className="text-[10px]">Ctrl</span>
                      <span>K</span>
                    </span>
                  </button>

                  <div className="flex flex-1 flex-wrap items-center justify-start gap-3 2xl:justify-center">
                    <ShellButton>
                      <CirclePlus size={16} strokeWidth={1.8} className="text-[var(--q-text-faint)]" />
                      <span>Quick Add</span>
                    </ShellButton>
                    <ShellButton>
                      <Dices size={16} strokeWidth={1.8} className="text-[var(--q-text-faint)]" />
                      <span>Randomizer</span>
                    </ShellButton>
                    <ShellButton>
                      <CalendarDays size={16} strokeWidth={1.8} className="text-[var(--q-text-faint)]" />
                      <span>Calendar</span>
                    </ShellButton>
                    <ShellButton>
                      <Map size={16} strokeWidth={1.8} className="text-[var(--q-text-faint)]" />
                      <span>DM Tools</span>
                    </ShellButton>
                  </div>

                  <div className="flex items-center gap-3">
                    <ShellButton className="h-12 bg-[var(--q-amber-trace)] px-5 text-[var(--q-amber)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04),0_12px_28px_-22px_hsl(35_80%_48%_/_0.42)]">
                      <Sparkles size={15} strokeWidth={1.8} />
                      <span>Ask the Brain</span>
                    </ShellButton>
                    <UtilityCircle>
                      <MoonStar size={18} strokeWidth={1.8} />
                    </UtilityCircle>
                    <UtilityCircle>
                      <Bell size={18} strokeWidth={1.8} />
                    </UtilityCircle>
                    <div className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--q-amber-trace)] text-[var(--q-amber)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.05)]">
                      <div className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--q-surface-utility)]/70 font-[var(--q-font-display)] text-sm">
                        Q
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <Card
                      variant="hero"
                      className="relative overflow-hidden !p-0 [clip-path:polygon(0_0,calc(100%_-_16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%_-_16px))]"
                    >
                      <div className="grid min-h-[474px] grid-cols-1 lg:grid-cols-[1fr_1fr]">
                        <div className="relative z-10 flex flex-col justify-between gap-8 p-8 md:p-9">
                          <div className="space-y-5">
                            <Overline>Next Session</Overline>
                            <div className="max-w-[33rem]">
                              <div className="mb-4 font-[var(--q-font-display)] text-[1.2rem] text-[var(--q-text-dim)]">
                                The Stonewardens Campaign
                              </div>
                              <h1 className="max-w-[10ch] text-balance font-[var(--q-font-display)] text-[clamp(3.4rem,5.6vw,6rem)] leading-[0.88] text-[var(--q-text)]">
                                The Shattered Spire
                              </h1>
                              <p className="mt-6 max-w-[31rem] text-pretty text-[18px] leading-8 text-[var(--q-text-dim)]">
                                The party ascends the broken stair of an ancient tower to confront
                                the force awakening beneath the ruins.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="flex flex-wrap gap-x-12 gap-y-4 text-[15px] text-[var(--q-text-dim)]">
                              <div className="inline-flex items-start gap-3">
                                <CalendarDays size={18} className="mt-1 text-[var(--q-text-faint)]" />
                                <div>
                                  <div>Saturday, May 24</div>
                                  <div className="text-[var(--q-text-faint)]">7:00 PM</div>
                                </div>
                              </div>
                              <div className="inline-flex items-start gap-3">
                                <ScrollText size={18} className="mt-1 text-[var(--q-text-faint)]" />
                                <div>
                                  <div>Session 18</div>
                                  <div className="text-[var(--q-text-faint)]">3-4 hrs</div>
                                </div>
                              </div>
                              <div className="inline-flex items-start gap-3">
                                <Users size={18} className="mt-1 text-[var(--q-text-faint)]" />
                                <div>
                                  <div>6 Players</div>
                                  <div className="text-[var(--q-text-faint)]">Level 7</div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <Button className="h-11 rounded-xl px-6 text-sm">Continue Prep</Button>
                              <Button variant="outline" className="h-11 rounded-xl px-6 text-sm">
                                Session Overview
                              </Button>
                              <Button variant="outline" className="h-11 rounded-xl px-6 text-sm">
                                DM Screen
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="relative hidden min-h-[474px] lg:block">
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                'radial-gradient(circle at 53% 18%, hsl(215 24% 82% / 0.32), transparent 13%), radial-gradient(circle at 50% 18%, hsl(220 18% 74% / 0.18), transparent 26%), radial-gradient(ellipse at 56% 10%, hsl(220 26% 64% / 0.12), transparent 34%), linear-gradient(180deg, hsl(220 30% 19%) 0%, hsl(220 22% 11%) 38%, hsl(220 28% 7%) 100%)',
                            }}
                          />
                          <div
                            className="absolute inset-x-[8%] top-[13%] h-[18%]"
                            style={{
                              background:
                                'radial-gradient(ellipse at center, hsl(220 15% 88% / 0.09), transparent 65%)',
                            }}
                          />
                          <div
                            className="absolute inset-x-[10%] top-[16%] h-[24%]"
                            style={{
                              background:
                                'radial-gradient(ellipse at center, hsl(220 20% 85% / 0.05), transparent 68%)',
                            }}
                          />
                          <div
                            className="absolute left-[4%] top-[20%] h-[28%] w-[36%]"
                            style={{
                              background:
                                'linear-gradient(135deg, transparent 0%, hsl(220 18% 18% / 0.22) 30%, transparent 78%)',
                              clipPath: 'polygon(0 70%, 46% 25%, 90% 40%, 100% 100%, 0 100%)',
                            }}
                          />
                          <div
                            className="absolute right-[0%] top-[24%] h-[34%] w-[28%]"
                            style={{
                              background:
                                'linear-gradient(225deg, transparent 0%, hsl(220 18% 18% / 0.18) 32%, transparent 72%)',
                              clipPath: 'polygon(0 34%, 44% 12%, 100% 34%, 100% 100%, 18% 100%)',
                            }}
                          />
                          <div
                            className="absolute bottom-[8%] left-[36%] h-[80%] w-[38%] rounded-t-[42%] rounded-b-[8%]"
                            style={{
                              background:
                                'linear-gradient(180deg, hsl(220 18% 24%) 0%, hsl(220 18% 13%) 50%, hsl(220 22% 7%) 100%)',
                              clipPath:
                                'polygon(49% 0%, 55% 7%, 54% 17%, 60% 23%, 58% 34%, 66% 45%, 64% 57%, 72% 68%, 69% 80%, 77% 100%, 25% 100%, 30% 82%, 28% 67%, 34% 53%, 33% 43%, 38% 29%, 40% 15%, 44% 6%)',
                              boxShadow:
                                '0 0 46px hsl(220 45% 10% / 0.34), inset 0 0 0 1px hsl(35 60% 50% / 0.06)',
                            }}
                          />
                          <div
                            className="absolute bottom-[7%] left-[20%] h-[22%] w-[60%]"
                            style={{
                              background:
                                'linear-gradient(180deg, transparent 0%, hsl(220 22% 6% / 0.18) 15%, hsl(220 22% 6% / 0.72) 100%)',
                              clipPath: 'polygon(0 75%, 22% 58%, 34% 62%, 48% 46%, 64% 58%, 81% 44%, 100% 66%, 100% 100%, 0 100%)',
                            }}
                          />
                          <div
                            className="absolute bottom-0 left-0 right-0 top-0"
                            style={{
                              background:
                                'linear-gradient(90deg, var(--q-surface-hero) 0%, hsl(220 25% 9% / 0.62) 20%, transparent 52%), linear-gradient(180deg, transparent 0%, hsl(220 25% 4% / 0.08) 62%, hsl(220 25% 4% / 0.78) 100%)',
                            }}
                          />
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="xl:col-span-4 xl:pt-8">
                    <Section
                      label="World Activity"
                      action={
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)]"
                        >
                          View All Activity
                          <ChevronRight size={12} />
                        </button>
                      }
                    >
                      <div className="space-y-2">
                        {activityItems.map((item) => (
                          <Card
                            key={item.title}
                            variant="detail"
                            className="flex items-center gap-3 rounded-xl !px-4 !py-4"
                          >
                            <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--q-amber-trace)]/40 text-[var(--q-amber-dim)] shadow-[inset_0_0_0_1px_hsl(35_80%_60%_/_0.1)]">
                              <Shield size={17} strokeWidth={1.8} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-[var(--q-font-display)] text-lg text-[var(--q-text)]">
                                {item.title}
                              </div>
                              <div className="mt-1 text-xs text-[var(--q-text-faint)]">{item.date}</div>
                            </div>
                            <div className="text-sm text-[var(--q-amber-dim)]">{item.status}</div>
                          </Card>
                        ))}
                      </div>
                    </Section>
                  </div>

                  <div className="xl:col-span-8">
                    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.45fr_1fr]">
                      <Section
                        label="Recent Sessions"
                        action={
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)]"
                          >
                            View All Sessions
                            <ChevronRight size={12} />
                          </button>
                        }
                      >
                        <div className="space-y-2">
                          {sessionRows.map((session) => (
                            <Card
                              key={session.number}
                              variant="list"
                              className="grid grid-cols-[44px_1fr_auto_auto] items-center gap-4 rounded-xl !px-5 !py-4"
                            >
                              <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text-faint)] tabular-nums">
                                {session.number}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-[var(--q-font-display)] text-xl text-[var(--q-text)]">
                                  {session.title}
                                </div>
                              </div>
                              <div className="text-xs text-[var(--q-text-faint)] tabular-nums">
                                {session.date}
                              </div>
                              <div className="text-xs text-[var(--q-text-faint)] tabular-nums">
                                {session.duration}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </Section>

                      <Section label="Active Campaign">
                        <Card variant="detail" className="space-y-6 !px-6 !py-5">
                          <div className="flex items-start gap-4">
                            <div className="inline-flex size-16 items-center justify-center rounded-xl bg-[linear-gradient(160deg,var(--q-amber-trace),transparent)] shadow-[inset_0_0_0_1px_hsl(35_80%_60%_/_0.18)]">
                              <Shield size={28} className="text-[var(--q-amber)]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-[var(--q-font-display)] text-[2.15rem] leading-none text-[var(--q-text)]">
                                The Stonewardens
                              </div>
                              <div className="mt-3 text-sm text-[var(--q-text-faint)]">
                                Ongoing since January 11, 2025
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                              Level 3 to 10
                            </div>
                            <div className="mb-3 flex items-end justify-between">
                              <div className="h-2 w-[70%] overflow-hidden rounded-full bg-[var(--q-amber-trace)]">
                                <div className="h-full w-[58%] bg-[var(--q-amber)]" />
                              </div>
                              <div className="text-right">
                                <div className="font-[var(--q-font-display)] text-4xl leading-none tabular-nums">
                                  7
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                                  Current
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-3 border-t border-[var(--q-border-subtle)] pt-4">
                            {[
                              ['18', 'Sessions'],
                              ['62', 'NPCs'],
                              ['48', 'Locations'],
                              ['128', 'Items'],
                            ].map(([value, label]) => (
                              <div key={label} className="text-center">
                                <div className="font-[var(--q-font-display)] text-3xl tabular-nums text-[var(--q-text)]">
                                  {value}
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                                  {label}
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button variant="outline" className="h-12 w-full justify-center rounded-xl text-sm">
                            Campaign Overview
                          </Button>
                        </Card>
                      </Section>
                    </div>
                  </div>

                  <div className="xl:col-span-4">
                    <Section
                      label="Prep Reminders"
                      action={
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)]"
                        >
                          View All
                          <ChevronRight size={12} />
                        </button>
                      }
                    >
                      <Card variant="detail" className="space-y-2 !p-4">
                        {reminderItems.map((item) => (
                          <div key={item.title} className="flex items-start gap-3 rounded-lg px-2 py-3">
                            <div className="mt-1 size-5 rounded-[6px] border border-[var(--q-border-subtle)] bg-black/10" />
                            <div className="min-w-0">
                              <div className="text-sm text-[var(--q-text)]">{item.title}</div>
                              <div className="mt-1 text-[11px] text-[var(--q-text-faint)]">{item.note}</div>
                            </div>
                          </div>
                        ))}
                      </Card>
                    </Section>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
