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
      {searchParams.get('fresh') !== '1' && (
        <meta httpEquiv="refresh" content="0;url=/campaigns?fresh=1" />
      )}

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-[var(--q-font-display)] text-2xl tracking-wide text-[var(--q-text)]">
            Campaigns
          </h1>
          <Button onClick={() => setCreateOpen(true)} data-testid="new-campaign-cta">
            <Plus size={16} className="mr-2" />
            New Campaign
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : !memberships || memberships.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-[var(--q-border-subtle)] py-24 text-center">
            <p className="font-[var(--q-font-display)] text-sm uppercase tracking-[2px] text-[var(--q-text-faint)]">
              No campaigns yet
            </p>
            <Button className="mt-6" onClick={() => setCreateOpen(true)}>
              Create your first campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {memberships.map((c) => {
              const isActive = c.id === active?.id
              const isOwner = c.role === 'OWNER'
              return (
                <div
                  key={c.id}
                  data-testid={`campaign-card-${c.slug}`}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-sm border bg-[var(--q-surface)] transition-colors',
                    isActive
                      ? 'border-[var(--q-amber-dim)]'
                      : 'border-[var(--q-border-subtle)] hover:border-[var(--q-amber-trace)]',
                  )}
                >
                  {isActive && (
                    <span className="absolute right-3 top-3 rounded-sm bg-[var(--q-amber-trace)] px-2 py-0.5 text-[10px] uppercase tracking-[2px] text-[var(--q-amber)]">
                      Active
                    </span>
                  )}

                  <Link
                    href={`/campaigns/${c.slug}/sessions`}
                    className="flex flex-1 flex-col gap-2 p-5"
                  >
                    <p className="font-[var(--q-font-display)] text-lg text-[var(--q-text)]">
                      {c.name}
                    </p>
                    <p className="text-xs text-[var(--q-text-faint)]">
                      {c.role} · {c.sessionCount ?? 0} sessions
                    </p>
                    {c.lastSessionDate && (
                      <p className="mt-auto text-[11px] text-[var(--q-text-faint)]">
                        Last played {new Date(c.lastSessionDate).toLocaleDateString()}
                      </p>
                    )}
                  </Link>

                  <div className="flex items-center justify-end border-t border-[var(--q-border-subtle)] px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Campaign actions"
                          data-testid={`campaign-card-kebab-${c.slug}`}
                          className="rounded-sm p-1.5 text-[var(--q-text-faint)] hover:text-[var(--q-text)]"
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
                </div>
              )
            })}
          </div>
        )}
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
