'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  ScrollText,
  Calendar,
  MapPin,
  Users,
  Skull,
  Package,
  Map,
  BookOpen,
  Compass,
  Boxes,
  Settings,
  ChevronsLeft,
  ChevronsRight,
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
  { id: 'home',       label: 'Home',       icon: Home,       globalHref: '/' },
  { id: 'campaigns',  label: 'Campaigns',  icon: ScrollText, globalHref: '/campaigns' },
  { id: 'sessions',   label: 'Sessions',   icon: Calendar,   scopedPath: '/sessions',          fallbackHref: '/campaigns' },
  { id: 'locations',  label: 'Locations',  icon: MapPin,     scopedPath: '/world?filter=location', fallbackHref: '/campaigns' },
  { id: 'npcs',       label: 'NPCs',       icon: Users,      scopedPath: '/npcs',              fallbackHref: '/campaigns' },
  { id: 'monsters',   label: 'Monsters',   icon: Skull,      globalHref: '/homebrew?type=creature' },
  { id: 'items',      label: 'Items',      icon: Package,    globalHref: '/homebrew?type=item' },
  { id: 'maps',       label: 'Maps',       icon: Map,        scopedPath: '/world-map',         fallbackHref: '/campaigns' },
  { id: 'lore',       label: 'Lore',       icon: BookOpen,   scopedPath: '/world?filter=lore', fallbackHref: '/campaigns' },
  { id: 'quests',     label: 'Quests',     icon: Compass,    scopedPath: '/quests',            fallbackHref: '/campaigns' },
  { id: 'assets',     label: 'Assets',     icon: Boxes,      globalHref: '/homebrew' },
] as const

const STORAGE_KEY = 'quiver.rail.collapsed'
const RAIL_WIDTH_EXPANDED = 200
const RAIL_WIDTH_COLLAPSED = 56

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

  const campaignSlug = slot?.campaignSlug

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
        'border-r border-[var(--q-border-subtle)]',
        'bg-[var(--q-surface-sunken)]',
        'transition-[width] duration-200 ease-out overflow-hidden',
      )}
      style={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH_EXPANDED }}
    >
      <Link
        href="/"
        aria-label="QuiverDM home"
        className={cn(
          'h-16 flex items-center gap-3 border-b border-[var(--q-border-subtle)] shrink-0',
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
                  : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)] hover:bg-white/[0.03]',
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

      <div className="flex flex-col border-t border-[var(--q-border-subtle)] shrink-0">
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
          <div className="px-5 py-3 border-t border-[var(--q-border-subtle)] text-[10px] tracking-wider text-[var(--q-text-faint)]">
            QuiverDM v2.0.0
          </div>
        )}
      </div>
    </nav>
  )
}
