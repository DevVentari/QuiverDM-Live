'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Globe, BookOpen, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       href: '/',            icon: Home,     label: 'Home' },
  { id: 'world',      href: '/world',       icon: Globe,    label: 'World' },
  { id: 'compendium', href: '/compendium',  icon: BookOpen, label: 'Compendium' },
  { id: 'characters', href: '/characters',  icon: Users,    label: 'Characters' },
  { id: 'settings',   href: '/settings',    icon: Settings, label: 'Settings' },
] as const

export function CommandRail() {
  const pathname = usePathname()
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('quiver.rail.pinned')
    if (saved === 'true') setPinned(true)
  }, [])

  const togglePin = () => {
    const next = !pinned
    setPinned(next)
    localStorage.setItem('quiver.rail.pinned', String(next))
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      data-testid="command-rail"
      aria-label="Main navigation"
      className={cn(
        'hidden md:flex flex-col h-full shrink-0',
        'border-r border-[var(--q-border-subtle)]',
        'bg-[var(--q-surface-sunken)]',
        'transition-[width] duration-200 ease-out',
        pinned ? 'w-[260px]' : 'w-[56px]',
        'overflow-hidden',
      )}
    >
      {/* Logo mark */}
      <div className="h-12 flex items-center justify-center border-b border-[var(--q-border-subtle)] shrink-0">
        <span className="text-[var(--q-amber)] text-lg font-[var(--q-font-display)]">&#x2316;</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => (
          <Link
            key={id}
            href={href}
            data-testid={`rail-nav-${id}`}
            aria-label={label}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-sm min-h-[44px]',
              'transition-colors duration-150',
              isActive(href)
                ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)] hover:bg-[var(--q-border-subtle)]',
            )}
          >
            <Icon size={18} className="shrink-0" />
            {pinned && (
              <span className="text-sm font-[var(--q-font-body)] truncate">{label}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Pin toggle */}
      <button
        onClick={togglePin}
        aria-label={pinned ? 'Collapse rail' : 'Pin rail open'}
        className={cn(
          'h-10 flex items-center justify-center shrink-0',
          'border-t border-[var(--q-border-subtle)]',
          'text-[var(--q-text-faint)] hover:text-[var(--q-text)]',
          'transition-colors text-xs',
        )}
      >
        {pinned ? '‹' : '›'}
      </button>
    </nav>
  )
}
