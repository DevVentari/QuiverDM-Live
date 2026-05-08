'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Globe, BookOpen, Users, Settings, Menu, X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       href: '/',           icon: Home,     label: 'Home' },
  { id: 'world',      href: '/world',      icon: Globe,    label: 'World' },
  { id: 'compendium', href: '/compendium', icon: BookOpen, label: 'Compendium' },
  { id: 'characters', href: '/characters', icon: Users,    label: 'Characters' },
  { id: 'settings',   href: '/settings',   icon: Settings, label: 'Settings' },
] as const

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* Mobile top bar — hidden on md+ */}
      <header className="md:hidden flex items-center h-12 px-4 border-b border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] shrink-0">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--q-text-dim)]"
        >
          <Menu size={20} />
        </button>
        <span className="flex-1 text-center font-[var(--q-font-display)] text-xs tracking-[2px] text-[var(--q-amber)] uppercase">
          QuiverDM
        </span>
      </header>

      {/* Nav sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[260px] bg-[var(--q-surface-sunken)] border-r border-[var(--q-border-subtle)] p-0"
        >
          <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--q-border-subtle)]">
            <span className="font-[var(--q-font-display)] text-xs tracking-[2px] text-[var(--q-amber)] uppercase">
              QuiverDM
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="p-1">
              <X size={16} className="text-[var(--q-text-faint)]" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => (
              <Link
                key={id}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-sm min-h-[44px] text-sm',
                  isActive(href)
                    ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                    : 'text-[var(--q-text-dim)] hover:text-[var(--q-text)] hover:bg-[var(--q-border-subtle)]',
                )}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
