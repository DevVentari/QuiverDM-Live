'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, PlusCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, Pill } from '@/components/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'
import { format, isToday, isTomorrow } from 'date-fns'
import { cn } from '@/lib/utils'

interface CalendarSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function dateChip(d: Date): { label: string; tone: 'primary' | 'info' | 'neutral' } {
  if (isToday(d)) return { label: 'Tonight', tone: 'primary' }
  if (isTomorrow(d)) return { label: 'Tomorrow', tone: 'info' }
  return { label: format(d, 'EEE d MMM'), tone: 'neutral' }
}

export function CalendarSheet({ open, onOpenChange }: CalendarSheetProps) {
  const { data: campaigns, isLoading } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  })

  const upcoming = useMemo(() => {
    if (!campaigns) return []
    return campaigns
      .filter((c) => c.nextSession?.date)
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        campaignSlug: c.slug,
        session: c.nextSession!,
      }))
      .sort(
        (a, b) =>
          new Date(a.session.date).getTime() - new Date(b.session.date).getTime(),
      )
  }, [campaigns])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)] sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle className="font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">
            Calendar
          </SheetTitle>
          <SheetDescription className="text-[var(--q-text-dim)]">
            The next planned session for each of your campaigns.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-3">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}

          {!isLoading && upcoming.length === 0 && (
            <Card variant="detail" className="flex flex-col items-center gap-3 py-8 text-center">
              <Calendar size={20} className="text-[var(--q-amber-dim)]" />
              <p className="text-sm text-[var(--q-text-dim)]">No upcoming sessions scheduled.</p>
              <Button asChild variant="default" size="sm">
                <Link href="/campaigns" onClick={() => onOpenChange(false)}>
                  <PlusCircle size={14} className="mr-2" />
                  Schedule a session
                </Link>
              </Button>
            </Card>
          )}

          {upcoming.map(({ campaignId, campaignName, session }) => {
            const sessionDate = new Date(session.date)
            const chip = dateChip(sessionDate)
            return (
              <Link
                key={campaignId}
                href={`/session/${session.id}`}
                onClick={() => onOpenChange(false)}
                data-testid={`calendar-session-${session.id}`}
                className="group block"
              >
                <Card
                  variant="detail"
                  className={cn(
                    '!p-4 transition-colors',
                    'group-hover:border-[var(--q-amber-dim)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)]">
                        {campaignName}
                      </div>
                      <div className="mt-1 truncate font-[var(--q-font-display)] text-base text-[var(--q-text)]">
                        {session.title ?? `Session ${session.sessionNumber ?? ''}`.trim()}
                      </div>
                      <div className="mt-1 text-xs text-[var(--q-text-faint)]">
                        {format(sessionDate, 'EEEE, MMM d · h:mm a')}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Pill variant={chip.tone}>{chip.label}</Pill>
                      <ChevronRight
                        size={14}
                        className="text-[var(--q-text-faint)] transition-colors group-hover:text-[var(--q-amber-dim)]"
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}

          {!isLoading && upcoming.length > 0 && (
            <Button asChild variant="outline" size="sm" className="w-full justify-center">
              <Link href="/campaigns" onClick={() => onOpenChange(false)}>
                <PlusCircle size={14} className="mr-2" />
                Schedule another session
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
