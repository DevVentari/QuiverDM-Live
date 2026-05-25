'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import {
  Home,
  Calendar,
  Library,
  BookOpen,
  Settings,
  Shield,
  Sparkles,
  Map,
  Monitor,
  Compass,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  LayoutGrid,
  Shapes,
  Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHeaderStore } from '@/store/header-store'
import { CampaignSwitcher } from './CampaignSwitcher'

type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  /** When set, the href is global (not campaign-scoped). */
  globalHref?: string
  /** Path appended to /campaigns/[slug] when an active campaign is in the slot. */
  scopedPath?: string
  /** Fallback href when no campaign is active. */
  fallbackHref?: string
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home',       label: 'Home',       icon: Home,     globalHref: '/' },
  { id: 'sessions',   label: 'Sessions',   icon: Calendar, scopedPath: '/sessions',   fallbackHref: '/campaigns' },
  { id: 'party',      label: 'Party',      icon: Shield,   scopedPath: '/players',    fallbackHref: '/campaigns' },
  { id: 'compendium', label: 'Compendium', icon: Library,  globalHref: '/homebrew' },
  { id: 'sourcebook', label: 'Sourcebook', icon: BookOpen, scopedPath: '/sourcebook', fallbackHref: '/campaigns' },
  { id: 'mechanics',  label: 'Mechanics',  icon: Sparkles, scopedPath: '/mechanics',  fallbackHref: '/campaigns' },
] as const

const STORAGE_KEY = 'quiver.rail.collapsed'
const RAIL_WIDTH_EXPANDED = 200
const RAIL_WIDTH_COLLAPSED = 56

const DEV_STORAGE_KEY = 'quiver.rail.devExpanded'

type ToolItem = {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  href: string
}

const DEV_NAV_ITEMS: readonly NavItem[] = [
  { id: 'maps',    label: 'Maps',    icon: Map,     scopedPath: '/world-map', fallbackHref: '/campaigns' },
  { id: 'foundry', label: 'Foundry', icon: Monitor, scopedPath: '/foundry',   fallbackHref: '/campaigns' },
  { id: 'world',   label: 'World',   icon: BookOpen, scopedPath: '/world',    fallbackHref: '/campaigns' },
  { id: 'quests',  label: 'Quests',  icon: Compass, scopedPath: '/quests',    fallbackHref: '/campaigns' },
] as const

const DEV_TOOL_ITEMS: readonly ToolItem[] = [
  { id: 'design-system', label: 'Design System', icon: Layers,     href: '/dev/design-system' },
  { id: 'cards',         label: 'Cards',         icon: LayoutGrid, href: '/dev/cards' },
  { id: 'icons',         label: 'Icons',         icon: Shapes,     href: '/dev/icons' },
  { id: 'theme',         label: 'Theme',         icon: Palette,    href: '/dev/theme' },
] as const

function resolveHref(item: NavItem, campaignSlug: string | undefined): string {
  if (item.globalHref) return item.globalHref
  if (item.scopedPath && campaignSlug) return `/campaigns/${campaignSlug}${item.scopedPath}`
  return item.fallbackHref ?? '/'
}

export function CommandRail() {
  const pathname = usePathname()
  const slot = useHeaderStore((s) => s.slot)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const [devExpanded, setDevExpanded] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(DEV_STORAGE_KEY)
    if (saved === 'false') setDevExpanded(false)
  }, [])

  const toggleDev = () => {
    const next = !devExpanded
    setDevExpanded(next)
    localStorage.setItem(DEV_STORAGE_KEY, String(next))
  }

  // Fall back to the user's active campaign when the slot hasn't been
  // populated yet (e.g., on first paint before a page useEffect sets it).
  // Without this, scoped nav links resolve to /campaigns and the user gets
  // bounced through the campaign list on every cold click.
  const { data: activeCampaign } = trpc.campaigns.getActive.useQuery(undefined, {
    staleTime: 5 * 60_000,
  })
  const campaignSlug = slot?.campaignSlug ?? activeCampaign?.slug ?? undefined

  const resolvedHrefs = NAV_ITEMS.map((item) => ({
    id: item.id,
    path: resolveHref(item, campaignSlug).split('?')[0],
  }))
  const activeId = (() => {
    const matches = resolvedHrefs.filter(({ path }) =>
      path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/'),
    )
    if (matches.length === 0) return null
    return matches.reduce((best, cur) => (cur.path.length > best.path.length ? cur : best)).id
  })()
  const isActive = (id: string) => activeId === id

  return (
    <nav
      data-testid="command-rail"
      aria-label="Main navigation"
      className={cn(
        'hidden md:flex flex-col h-full shrink-0',
        'border-r border-[color-mix(in_oklab,var(--q-border-subtle)_70%,transparent)]',
        'bg-[color-mix(in_oklab,var(--q-shell-rail)_74%,transparent)] backdrop-blur-xl',
        'shadow-[inset_-1px_0_0_hsl(0_0%_100%_/_0.02)]',
        'transition-[width] duration-200 ease-out overflow-hidden',
      )}
      style={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED }}
    >
      <Link
        href="/"
        aria-label="QuiverDM home"
        className={cn(
          'h-16 flex items-center gap-3 border-b border-[color-mix(in_oklab,var(--q-border-subtle)_70%,transparent)] shrink-0',
          collapsed ? 'justify-center px-0' : 'px-5',
        )}
      >
        <span className="font-[var(--q-font-display)] text-2xl text-[var(--q-amber)] leading-none">
          &#x2316;
        </span>
        {!collapsed && (
          <span className="flex flex-col leading-tight">
            <span className="font-[var(--q-font-display)] text-base tracking-wide text-[var(--q-text)]">
              QuiverDM
            </span>
            <span className="text-[9px] uppercase tracking-[3px] text-[var(--q-amber-dim)]">
              V2
            </span>
          </span>
        )}
      </Link>

      <div className={cn('shrink-0', collapsed ? 'pt-2' : '')}>
        <CampaignSwitcher collapsed={collapsed} />
      </div>

      <div className="flex flex-col gap-0.5 px-2 pt-3 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, icon: Icon, label, ...item }) => {
          const href = resolveHref({ id, icon: Icon, label, ...item }, campaignSlug)
          const active = isActive(id)

          return (
            <Link
              key={id}
              href={href}
              data-testid={`rail-nav-${id}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-sm min-h-[40px]',
                'transition-colors duration-150',
                active
                  ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)] hover:bg-white/[0.025]',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-sm font-[var(--q-font-body)] truncate">{label}</span>
              )}
            </Link>
          )
        })}
      </div>

      <div className="flex flex-col border-t border-[color-mix(in_oklab,var(--q-border-subtle)_70%,transparent)] shrink-0">
        <Link
          href="/settings"
          data-testid="rail-nav-settings"
          aria-label="Settings"
          aria-current={isActive('/settings') ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-3 min-h-[44px]',
            'transition-colors duration-150',
            isActive('/settings')
              ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
              : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)]',
            collapsed && 'justify-center px-0',
          )}
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </Link>

        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand rail' : 'Collapse rail'}
          aria-pressed={collapsed}
          className={cn(
            'flex items-center gap-3 px-3 py-3 min-h-[44px]',
            'text-[var(--q-text-faint)] hover:text-[var(--q-text)]',
            'transition-colors text-left',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <ChevronsRight size={18} className="shrink-0" />
          ) : (
            <ChevronsLeft size={18} className="shrink-0" />
          )}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>

        {!collapsed && (
          <div className="px-5 py-3 border-t border-[color-mix(in_oklab,var(--q-border-subtle)_70%,transparent)] text-[10px] tracking-wider text-[var(--q-text-faint)]">
            QuiverDM v2.0.0
          </div>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && !collapsed && (
        <div
          className="border-t shrink-0"
          style={{
            borderColor: 'oklch(0.6 0.18 290 / 0.2)',
            background: 'oklch(0.6 0.18 290 / 0.02)',
          }}
        >
          <button
            onClick={toggleDev}
            aria-label={devExpanded ? 'Collapse dev section' : 'Expand dev section'}
            aria-expanded={devExpanded}
            className="flex items-center gap-2 w-full px-3 py-1.5 cursor-pointer"
          >
            <span
              className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
              style={{
                color: 'oklch(0.65 0.2 290)',
                background: 'oklch(0.6 0.18 290 / 0.12)',
                border: '1px solid oklch(0.6 0.18 290 / 0.3)',
              }}
            >
              DEV
            </span>
            <span className="ml-auto" style={{ color: 'oklch(0.4 0.01 265)' }}>
              {devExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </button>

          {devExpanded && (
            <div className="flex flex-col gap-px px-2 pb-2">
              {DEV_NAV_ITEMS.map(({ id, icon: Icon, label, ...item }) => {
                const href = resolveHref({ id, icon: Icon, label, ...item }, campaignSlug)
                const devActive = href !== '/campaigns' && (pathname === href || pathname.startsWith(href + '/'))
                return (
                  <Link
                    key={id}
                    href={href}
                    data-testid={`rail-dev-${id}`}
                    aria-label={label}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-1.5 rounded-sm text-xs min-h-[32px]',
                      'transition-colors duration-150',
                      devActive ? 'text-[var(--q-amber)]' : 'hover:text-[oklch(0.65_0.15_290)]',
                    )}
                    style={{ color: devActive ? undefined : 'oklch(0.45 0.01 265)' }}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}

              <div
                className="h-px my-1 mx-3"
                style={{ background: 'oklch(0.25 0.01 265 / 0.4)' }}
              />

              {DEV_TOOL_ITEMS.map(({ id, icon: Icon, label, href }) => {
                const devActive = pathname === href
                return (
                  <Link
                    key={id}
                    href={href}
                    data-testid={`rail-dev-${id}`}
                    aria-label={label}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-1.5 rounded-sm text-xs min-h-[32px]',
                      'transition-colors duration-150',
                      devActive ? 'text-[var(--q-amber)]' : 'hover:text-[oklch(0.65_0.15_290)]',
                    )}
                    style={{ color: devActive ? undefined : 'oklch(0.45 0.01 265)' }}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
