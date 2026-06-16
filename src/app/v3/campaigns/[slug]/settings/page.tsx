'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

// Subset of the Campaign record returned by campaigns.getBySlug.
interface CampaignRecord {
  id: string;
  name: string;
  description?: string | null;
  settings?: Record<string, unknown> | null;
}

// Subset of CampaignMember rows returned by members.getAll.
interface MemberRow {
  id: string;
  role: string;
  user?: {
    id: string;
    name?: string | null;
    displayName?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  CO_DM: 'Co-DM',
  PLAYER: 'Player',
  SPECTATOR: 'Spectator',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 font-qd-mono text-[8px] uppercase tracking-[0.14em] text-qd-ink-muted">
      {children}
    </div>
  );
}

function SectionLabel({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className="mb-3 mt-6 font-qd-mono text-[8px] uppercase tracking-[0.16em]"
      style={{ color: danger ? 'var(--qd-danger)' : 'var(--qd-ink-muted)' }}
    >
      {children}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="relative h-6 w-[42px] flex-none rounded-full"
      style={{ background: on ? 'var(--qd-success)' : 'rgba(255,255,255,.1)' }}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full"
        style={{
          right: on ? 3 : undefined,
          left: on ? undefined : 3,
          background: on ? 'var(--qd-ink-strong)' : 'var(--qd-ink-muted)',
        }}
      />
    </span>
  );
}

function ToggleRow({ title, subtitle, on }: { title: string; subtitle: string; on: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)] px-3.5 py-3">
      <div className="flex-1">
        <div className="text-qd-body-sm text-qd-ink-2">{title}</div>
        <div className="mt-0.5 font-qd-mono text-[8.5px] text-qd-ink-muted">{subtitle}</div>
      </div>
      <Toggle on={on} />
    </div>
  );
}

// Pending CampaignInvite row (subset returned by members.getInvites).
interface InviteRow {
  id: string;
  code?: string | null;
  email?: string | null;
  role: string;
  expiresAt?: string | null;
}

// Roles a DM may assign/invite (never OWNER — that goes through transfer ownership).
const ASSIGNABLE_ROLES = ['PLAYER', 'CO_DM', 'SPECTATOR'] as const;

/**
 * The campaign roster — live member management (role changes, removal) plus
 * invite creation/revocation. All mutations are DM-gated server-side
 * (campaignDMProcedure); OWNER rows are locked in the UI since the server
 * refuses to demote or remove the owner anyway.
 */
function RosterSection({ campaignId, isOwner }: { campaignId: string; isOwner: boolean }) {
  const utils = trpc.useUtils();
  const membersQuery = trpc.members.getAll.useQuery({ campaignId }, { staleTime: 60_000 });
  const invitesQuery = trpc.members.getInvites.useQuery({ campaignId }, { staleTime: 30_000 });

  const members = (membersQuery.data as MemberRow[] | undefined) ?? [];
  const invites = (invitesQuery.data as InviteRow[] | undefined) ?? [];

  const invalidate = () => {
    void utils.members.getAll.invalidate({ campaignId });
    void utils.members.getInvites.invalidate({ campaignId });
  };

  const updateRole = trpc.members.updateRole.useMutation({ onSuccess: invalidate });
  const remove = trpc.members.remove.useMutation({ onSuccess: invalidate });
  const createInvite = trpc.members.createInvite.useMutation({ onSuccess: invalidate });
  const revokeInvite = trpc.members.revokeInvite.useMutation({ onSuccess: invalidate });

  const [inviteRole, setInviteRole] = useState<string>('PLAYER');
  const [inviteEmail, setInviteEmail] = useState('');

  const submitInvite = () => {
    if (createInvite.isPending) return;
    const email = inviteEmail.trim();
    createInvite.mutate({
      campaignId,
      role: inviteRole as (typeof ASSIGNABLE_ROLES)[number],
      ...(email ? { email } : {}),
    });
    setInviteEmail('');
  };

  return (
    <>
      <SectionLabel>Roster · {members.length} members</SectionLabel>
      {membersQuery.isLoading ? (
        <div className="text-qd-body-sm text-qd-ink-muted">Counting the company…</div>
      ) : members.length === 0 ? (
        <div className="text-qd-body-sm text-qd-ink-muted">No one has joined the table yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const label = m.user?.displayName || m.user?.name || m.user?.email || 'Unknown';
            const locked = m.role === 'OWNER';
            const busy = (updateRole.isPending || remove.isPending) && (updateRole.variables?.memberId === m.id || remove.variables?.memberId === m.id);
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full bg-qd-accent text-[13px] font-bold text-qd-on-accent">
                  {m.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.image} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    label.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-qd-body-sm text-qd-ink-2">{label}</span>
                  {m.user?.email && (
                    <span className="block truncate font-qd-mono text-[8px] text-qd-ink-muted">{m.user.email}</span>
                  )}
                </span>
                {locked ? (
                  <span className="rounded-full border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-qd-mono text-[9px] text-qd-ink-2">
                    {ROLE_LABEL.OWNER}
                  </span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => updateRole.mutate({ campaignId, memberId: m.id, role: e.target.value as (typeof ASSIGNABLE_ROLES)[number] })}
                      className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2 py-1 font-qd-mono text-[10px] text-qd-ink-2 focus:border-qd-accent focus:outline-none"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => remove.mutate({ campaignId, memberId: m.id })}
                      disabled={busy}
                      title="Remove from campaign"
                      className="rounded-qd-md border border-qd-faint px-2 py-1 font-qd-mono text-[10px] text-qd-danger-bright transition-colors hover:border-qd-danger disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* INVITES */}
      <SectionLabel>Invites · {invites.length} pending</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2.5 py-2 font-qd-mono text-[11px] text-qd-ink-2 focus:border-qd-accent focus:outline-none"
        >
          {ASSIGNABLE_ROLES.filter((r) => r !== 'CO_DM' || isOwner).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
        <input
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitInvite(); }}
          placeholder="email (optional — blank makes a shareable code)"
          className="min-w-[260px] flex-1 rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 font-qd-mono text-[11px] text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
        />
        <button
          onClick={submitInvite}
          disabled={createInvite.isPending}
          className="rounded-qd-md bg-qd-accent px-3.5 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent disabled:opacity-50"
        >
          {createInvite.isPending ? 'Sealing…' : 'Create invite'}
        </button>
      </div>
      {createInvite.error && (
        <div className="mt-1.5 font-qd-mono text-[10px] text-qd-danger-bright">{createInvite.error.message}</div>
      )}

      {invites.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-qd-mono text-[11px] text-qd-ink-2">
                  {inv.email || (inv.code ? `code · ${inv.code}` : 'open invite')}
                </span>
                <span className="block font-qd-mono text-[8px] uppercase tracking-[0.1em] text-qd-ink-muted">
                  {ROLE_LABEL[inv.role] ?? inv.role}{inv.expiresAt ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}` : ''}
                </span>
              </span>
              {inv.code && (
                <button
                  onClick={() => { void navigator.clipboard?.writeText(inv.code ?? ''); }}
                  className="rounded-qd-md border border-qd-faint px-2 py-1 font-qd-mono text-[10px] text-qd-ink-2 transition-colors hover:border-qd-accent"
                >
                  Copy code
                </button>
              )}
              <button
                onClick={() => revokeInvite.mutate({ campaignId, inviteId: inv.id })}
                disabled={revokeInvite.isPending}
                className="rounded-qd-md border border-qd-faint px-2 py-1 font-qd-mono text-[10px] text-qd-danger-bright transition-colors hover:border-qd-danger disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CampaignSettingsPage() {
  const { campaignId, slug, isDM, isOwner } = useCampaign();
  const utils = trpc.useUtils();

  const campaignQuery = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 60_000 });

  const campaign = campaignQuery.data as CampaignRecord | undefined;

  // Controlled inputs seeded from the loaded campaign.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (campaign) {
      setName(campaign.name ?? '');
      setDescription(campaign.description ?? '');
    }
  }, [campaign]);

  const update = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      void utils.campaigns.getBySlug.invalidate({ slug });
    },
  });

  const dirty =
    !!campaign && (name !== (campaign.name ?? '') || description !== (campaign.description ?? ''));

  const handleSave = () => {
    if (!campaign || !name.trim()) return;
    update.mutate({ id: campaign.id, name: name.trim(), description });
  };

  if (campaignQuery.isLoading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Unrolling the campaign charter…</div>;
  }
  if (campaignQuery.error || !campaign) {
    return <div className="px-8 py-16 text-qd-ink-muted">The charter would not open. Try again.</div>;
  }

  const settings = (campaign.settings ?? {}) as Record<string, unknown>;
  const ruleset = (settings.gameSystem as string) || 'D&D 5e (2024)';
  const tone =
    Array.isArray(settings.themes) && (settings.themes as string[]).length
      ? (settings.themes as string[]).join(' · ')
      : 'Mythic · high stakes';

  return (
    <div className="flex h-full flex-col">
      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Settings</div>
          <div className="font-qd-mono text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">
            {campaign.name} · Campaign Settings
          </div>
        </div>
        <span className="flex-1" />
        {isOwner && (
          <button
            onClick={handleSave}
            disabled={!dirty || update.isPending || !name.trim()}
            className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* NAV */}
        <aside className="flex w-[222px] flex-none flex-col gap-1 border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          <div className="px-2 pb-2 pt-1 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-faint">
            Campaign
          </div>
          <span
            className="rounded-qd-lg border border-qd-accent px-3 py-2.5 text-qd-body-sm text-qd-ink-strong"
            style={{ background: 'linear-gradient(90deg,rgba(217,138,61,.16),transparent)' }}
          >
            Identity
          </span>
          <span className="rounded-qd-lg px-3 py-2.5 text-qd-body-sm text-qd-ink-2">Table defaults</span>
          {isDM && <span className="rounded-qd-lg px-3 py-2.5 text-qd-body-sm text-qd-ink-2">Roster</span>}
          <span className="rounded-qd-lg px-3 py-2.5 text-qd-body-sm text-qd-ink-2">Integrations</span>
          {isOwner && (
            <span className="rounded-qd-lg px-3 py-2.5 text-qd-body-sm" style={{ color: 'var(--qd-danger)' }}>
              Danger zone
            </span>
          )}
        </aside>

        {/* MAIN */}
        <div className="flex-1 overflow-auto p-6">
          {/* IDENTITY */}
          <div className="font-qd-display text-[22px] text-qd-ink-strong">Identity</div>

          <div className="mt-4 flex gap-5">
            <div className="grid h-[130px] w-[200px] flex-none place-items-center overflow-hidden rounded-qd-xl border border-qd-faint bg-[rgba(255,255,255,0.02)]">
              <span className="font-qd-mono text-[9px] text-qd-ink-faintest">drop cover art</span>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <FieldLabel>Campaign name</FieldLabel>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isOwner}
                  className="w-full rounded-qd-lg border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5 text-qd-body text-qd-ink focus:border-qd-accent focus:outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <FieldLabel>Tagline</FieldLabel>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isOwner}
                  rows={2}
                  placeholder="When the accord breaks, the sky breaks with it."
                  className="w-full resize-none rounded-qd-lg border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5 text-qd-body-sm italic text-qd-ink-2 placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3.5">
            <div>
              <FieldLabel>Ruleset</FieldLabel>
              <div className="flex items-center justify-between rounded-qd-lg border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5">
                <span className="text-qd-body text-qd-ink">{ruleset}</span>
                <span className="text-qd-ink-muted">▾</span>
              </div>
            </div>
            <div>
              <FieldLabel>Tone</FieldLabel>
              <div className="flex items-center justify-between rounded-qd-lg border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5">
                <span className="text-qd-body text-qd-ink">{tone}</span>
                <span className="text-qd-ink-muted">▾</span>
              </div>
            </div>
          </div>

          {/* TABLE DEFAULTS — display-only toggles (// TODO wire to settings) */}
          <SectionLabel>Table defaults</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <ToggleRow title="Auto-sort initiative" subtitle="order by roll automatically" on />
            <ToggleRow title="Fog of war on by default" subtitle="new battle maps start hidden" on />
            <ToggleRow title="AI session recap" subtitle="summarize after each session" on />
            <ToggleRow title="Advantage prompts" subtitle="ask adv/disadv on every roll" on={false} />
          </div>

          {/* ROSTER — live member + invite management (DM/owner only) */}
          {isDM && <RosterSection campaignId={campaignId} isOwner={isOwner} />}

          {/* INTEGRATIONS — display-only */}
          <SectionLabel>Integrations</SectionLabel>
          <div className="flex gap-2.5">
            <div
              className="flex flex-1 items-center gap-3 rounded-qd-lg border px-3.5 py-3"
              style={{ borderColor: 'var(--qd-success)', background: 'rgba(95,143,69,.08)' }}
            >
              <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-qd-md bg-[rgba(95,143,69,.16)] text-sm">
                🎙
              </span>
              <div className="flex-1">
                <div className="text-qd-body-sm text-qd-ink-2">Discord voice</div>
                <div className="mt-0.5 font-qd-mono text-[8.5px]" style={{ color: 'var(--qd-success)' }}>
                  connected · live transcription
                </div>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3 rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)] px-3.5 py-3">
              <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-qd-md bg-[rgba(255,255,255,0.05)] text-sm">
                🗺
              </span>
              <div className="flex-1">
                <div className="text-qd-body-sm text-qd-ink-2">VTT export</div>
                <div className="mt-0.5 font-qd-mono text-[8.5px] text-qd-ink-muted">Roll20 · Foundry</div>
              </div>
              <span className="flex-none font-qd-mono text-[9px] text-qd-accent-text">Connect</span>
            </div>
          </div>

          {/* DANGER ZONE — owner only, delete is a no-op placeholder */}
          {isOwner && (
            <>
              <SectionLabel danger>Danger zone</SectionLabel>
              <div
                className="flex items-center gap-3.5 rounded-qd-lg border px-4 py-3.5"
                style={{ borderColor: 'var(--qd-danger)', background: 'rgba(196,69,58,.06)' }}
              >
                <div className="flex-1">
                  <div className="text-qd-body-sm" style={{ color: 'var(--qd-ink-2)' }}>
                    Archive or delete this campaign
                  </div>
                  <div className="mt-0.5 font-qd-mono text-[8.5px]" style={{ color: 'var(--qd-danger)' }}>
                    archiving hides it; deleting is permanent
                  </div>
                </div>
                <button
                  // TODO: wire archive via campaigns.update({ status: 'archived' })
                  onClick={() => {}}
                  className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-3.5 py-2 font-qd-display text-[13px] text-qd-ink-2"
                >
                  Archive
                </button>
                <button
                  // TODO: wire delete via campaigns.delete — placeholder confirm only, do NOT call.
                  onClick={() => {
                    window.confirm('Delete this campaign? (not yet wired)');
                  }}
                  className="rounded-qd-md px-3.5 py-2 font-qd-display text-[13px] font-bold"
                  style={{ border: '1px solid var(--qd-danger)', background: 'rgba(196,69,58,.16)', color: 'var(--qd-danger)' }}
                >
                  Delete…
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
