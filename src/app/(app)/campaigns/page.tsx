'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Check,
  LogOut,
  MoreVertical,
  Plus,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { CampaignCreateSheet } from '@/components/campaign/campaign-create-sheet'
import { Card, Section, Surface } from '@/components/primitives'
import { cn } from '@/lib/utils'

function CampaignsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const utils = trpc.useUtils()
  const { toast } = useToast()

  const createOpen = searchParams.get('create') === 'true'
  const setCreateOpen = (open: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (open) params.set('create', 'true')
    else params.delete('create')
    router.replace(`/campaigns${params.toString() ? `?${params}` : ''}`, { scroll: false })
  }

  const { data: memberships, isLoading } = trpc.campaigns.getMyMemberships.useQuery()
  const { data: active } = trpc.campaigns.getActive.useQuery()

  const setActive = trpc.userSettings.setActiveCampaign.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.campaigns.getActive.invalidate(),
        utils.campaigns.getMyMemberships.invalidate(),
        utils.sessions.getAll.invalidate(),
      ])
      router.push('/')
    },
    onError: () => toast({ title: 'Switch failed', variant: 'destructive' }),
  })

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      void utils.campaigns.getMyMemberships.invalidate()
      void utils.campaigns.getActive.invalidate()
      setConfirmDelete(null)
      toast({ title: 'Campaign deleted' })
    },
    onError: (e) =>
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  })

  const leaveCampaign = trpc.members.leave.useMutation({
    onSuccess: () => {
      void utils.campaigns.getMyMemberships.invalidate()
      void utils.campaigns.getActive.invalidate()
      toast({ title: 'You left the campaign' })
    },
    onError: (e) =>
      toast({ title: 'Leave failed', description: e.message, variant: 'destructive' }),
  })

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <Section
          label="Library"
          title="Campaigns"
          tone="ceremonial"
          action={
            <Button onClick={() => setCreateOpen(true)} data-testid="new-campaign-cta">
              <Plus size={16} className="mr-2" />
              New Campaign
            </Button>
          }
        >
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44 w-full" />
              ))}
            </div>
          ) : !memberships || memberships.length === 0 ? (
            <Card
              variant="detail"
              className="flex flex-col items-center justify-center gap-5 py-24 text-center"
            >
              <div className="space-y-2">
                <p className="font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.5px] text-[var(--q-amber-dim)]">
                  No worlds yet
                </p>
                <p className="font-[var(--q-font-display)] text-xl text-[var(--q-text-dim)]">
                  Your chronicle awaits
                </p>
                <p className="max-w-xs text-sm text-[var(--q-text-faint)]">
                  Every great campaign starts with a name. Forge your first world and the rest follows.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                Forge your first campaign
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {memberships.map((c) => {
                const isActive = c.id === active?.id
                const isOwner = c.role === 'OWNER'
                return (
                  <Surface
                    key={c.id}
                    variant={isActive ? 'feature' : 'utility'}
                    grain={isActive}
                    data-testid={`campaign-card-${c.slug}`}
                    className={cn(
                      'group relative flex flex-col overflow-hidden',
                      isActive
                        ? 'border-[var(--q-amber-border)]'
                        : 'hover:border-[var(--q-amber-trace)]',
                    )}
                  >
                    {/* Amber top-rule — always subtle, glows on active */}
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity',
                        isActive
                          ? 'via-[var(--q-amber-border)] opacity-100'
                          : 'via-[var(--q-border-feature)] opacity-60 group-hover:opacity-100',
                      )}
                    />
                    {/* Amber left-bar for active card */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-[var(--q-amber)] via-[var(--q-amber-border)] to-transparent"
                      />
                    )}

                    <Link
                      href={`/campaigns/${c.slug}/sessions`}
                      className="flex flex-1 flex-col gap-3 p-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-[var(--q-font-display)] text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                          Campaign · {c.role.charAt(0) + c.role.slice(1).toLowerCase()}
                        </p>
                        {isActive && (
                          <span className="shrink-0 rounded-sm bg-[var(--q-amber-trace)] px-2 py-0.5 text-[9px] uppercase tracking-[2px] text-[var(--q-amber)]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="font-[var(--q-font-display)] text-xl leading-snug text-[var(--q-text)]">
                        {c.name}
                      </p>
                      <div className="mt-auto flex items-center gap-3 text-[11px] text-[var(--q-text-faint)]">
                        <span>{c.sessionCount ?? 0} sessions</span>
                        {c.lastSessionDate && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>Last played {new Date(c.lastSessionDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center justify-end border-t border-[var(--q-border-subtle)]/60 px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Campaign actions"
                          data-testid={`campaign-card-kebab-${c.slug}`}
                          className="rounded-sm p-1.5 text-[var(--q-text-faint)] transition-colors hover:text-[var(--q-amber)]"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isActive && (
                          <DropdownMenuItem
                            data-testid={`set-active-${c.slug}`}
                            onClick={() => setActive.mutate({ campaignId: c.id })}
                          >
                            <Check className="mr-2 h-3.5 w-3.5" /> Set as active
                          </DropdownMenuItem>
                        )}
                        {isActive && (
                          <DropdownMenuItem disabled>
                            <Check className="mr-2 h-3.5 w-3.5" /> Currently active
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/campaigns/${c.slug}/settings`}>
                            <SettingsIcon className="mr-2 h-3.5 w-3.5" /> Settings
                          </Link>
                        </DropdownMenuItem>
                        {isOwner ? (
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete campaign
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => leaveCampaign.mutate({ campaignId: c.id })}>
                            <LogOut className="mr-2 h-3.5 w-3.5" /> Leave
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Surface>
              )
            })}
          </div>
        )}
        </Section>
      </div>

      <CampaignCreateSheet open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{confirmDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign, its sessions, NPCs, and all related
              content. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteCampaign.mutate({ id: confirmDelete.id })}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsPageInner />
    </Suspense>
  )
}
