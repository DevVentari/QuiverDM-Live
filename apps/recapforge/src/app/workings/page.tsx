'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Masthead } from '@/components/manuscript/Masthead';

function Workings() {
  const params = useSearchParams();
  const campaignParam = params.get('campaign');

  const mine = trpc.forgeCampaign.mine.useQuery();
  const campaign = mine.data?.find((c) => c.id === campaignParam) ?? mine.data?.[0] ?? null;
  const campaignId = campaign?.id ?? '';

  const party = trpc.forgeCampaign.party.useQuery({ campaignId }, { enabled: !!campaignId });
  const cobalt = trpc.forgeKeys.cobaltStatus.useQuery();

  const addMember = trpc.forgeCampaign.addPartyMember.useMutation();
  const removeMember = trpc.forgeCampaign.removePartyMember.useMutation();
  const importParty = trpc.forgeCampaign.importParty.useMutation();
  const setCobalt = trpc.forgeKeys.setCobalt.useMutation();
  const clearCobalt = trpc.forgeKeys.clearCobalt.useMutation();

  const [playerName, setPlayerName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [cobaltValue, setCobaltValue] = useState('');
  const [ddbUrl, setDdbUrl] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [noteTone, setNoteTone] = useState<'ink' | 'mark'>('ink');

  const say = (text: string, tone: 'ink' | 'mark' = 'ink') => {
    setNote(text);
    setNoteTone(tone);
  };

  if (!campaign) return <main className="rf-page" />;

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', font: 'inherit', background: 'transparent',
    border: 'none', borderBottom: '1px solid var(--rf-rule-dot)', outline: 'none',
  };

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 880 }}>
        <div className="rf-paper">
          <Masthead>
            <nav className="rf-masthead__nav">
              <Link href={`/?campaign=${campaignId}`} className="rf-masthead__link">Ledger</Link>
              <span className="rf-masthead__link is-active">Workings</span>
            </nav>
          </Masthead>

          <div className="rf-compose__body">
            <div className="rf-eyebrow">The workings of</div>
            <h1 className="rf-compose__title" style={{ marginTop: 6 }}>{campaign.name}</h1>

            {/* ---- The party ---- */}
            <div style={{ marginTop: 40 }}>
              <div className="rf-section-rule">
                <span>The party</span>
                <span className="rf-rule-line" />
              </div>

              <div style={{ marginTop: 14 }}>
                {(party.data ?? []).map((p) => (
                  <div
                    key={p.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px dotted var(--rf-rule-dot)' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{p.characterName}</span>
                    <span style={{ flex: 1, fontStyle: 'italic', color: 'var(--rf-ink-muted)', fontSize: 14 }}>
                      {p.name}
                      {p.characterClass ? ` · ${p.characterClass}` : ''}
                    </span>
                    <button
                      className="rf-btn rf-btn--stet"
                      disabled={removeMember.isPending}
                      onClick={async () => {
                        setNote(null);
                        await removeMember.mutateAsync({ campaignId, playerId: p.id });
                        await party.refetch();
                        say(`${p.characterName} struck from the party — the name stays in the lexicon as an NPC.`);
                      }}
                    >
                      strike from the party
                    </button>
                  </div>
                ))}
                {(party.data ?? []).length === 0 && (
                  <div style={{ padding: '14px 0', fontStyle: 'italic', color: 'var(--rf-ink-muted)' }}>
                    No heroes are sworn to this chronicle yet.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input aria-label="Player name" placeholder="Player" value={playerName} onChange={(e) => setPlayerName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
                <input aria-label="Character name" placeholder="Character" value={characterName} onChange={(e) => setCharacterName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
                <button
                  className="rf-btn rf-btn--ghost"
                  disabled={!playerName.trim() || !characterName.trim() || addMember.isPending}
                  onClick={async () => {
                    setNote(null);
                    try {
                      await addMember.mutateAsync({ campaignId, playerName: playerName.trim(), characterName: characterName.trim() });
                      setPlayerName('');
                      setCharacterName('');
                      await party.refetch();
                    } catch (e) {
                      say(e instanceof Error ? e.message : 'That name would not take — try again.', 'mark');
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* ---- The Beyond seal ---- */}
            <div style={{ marginTop: 48 }}>
              <div className="rf-section-rule">
                <span>The Beyond seal</span>
                <span className="rf-rule-line" />
              </div>

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                {cobalt.data?.set ? (
                  <>
                    <span className="rf-mono" style={{ fontSize: 12 }}>seal on file {cobalt.data.hint}</span>
                    <button
                      className="rf-btn rf-btn--stet"
                      disabled={clearCobalt.isPending}
                      onClick={async () => {
                        await clearCobalt.mutateAsync();
                        await cobalt.refetch();
                        say('The seal is broken — imports will need a fresh cookie.');
                      }}
                    >
                      break the seal
                    </button>
                  </>
                ) : (
                  <span style={{ fontStyle: 'italic', color: 'var(--rf-ink-muted)', fontSize: 14 }}>
                    No seal on file — paste your D&D Beyond CobaltSession cookie to import the party.
                  </span>
                )}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <textarea
                  aria-label="Cobalt cookie"
                  rows={2}
                  value={cobaltValue}
                  onChange={(e) => setCobaltValue(e.target.value)}
                  placeholder="CobaltSession cookie value"
                  style={{ flex: 1, minWidth: 260, padding: 10, fontFamily: 'var(--rf-font-mono)', fontSize: 12, background: 'transparent', border: '1px dashed var(--rf-rule-dot)', outline: 'none' }}
                />
                <button
                  className="rf-btn rf-btn--ghost"
                  disabled={cobaltValue.trim().length < 20 || setCobalt.isPending}
                  onClick={async () => {
                    setNote(null);
                    try {
                      await setCobalt.mutateAsync({ cookie: cobaltValue.trim() });
                      setCobaltValue('');
                      await cobalt.refetch();
                      say('The seal is set.');
                    } catch (e) {
                      say(e instanceof Error ? e.message : 'That seal would not take.', 'mark');
                    }
                  }}
                >
                  {cobalt.data?.set ? 'Replace the seal' : 'Keep the seal'}
                </button>
              </div>

              {/* re-import */}
              <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  aria-label="D&D Beyond campaign URL"
                  placeholder="https://www.dndbeyond.com/campaigns/…"
                  value={ddbUrl}
                  onChange={(e) => setDdbUrl(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 260, fontFamily: 'var(--rf-font-mono)', fontSize: 12, border: '1px dashed var(--rf-rule-dot)' }}
                />
                <button
                  className="rf-btn rf-btn--solid"
                  disabled={!ddbUrl.trim() || !cobalt.data?.set || importParty.isPending}
                  onClick={async () => {
                    setNote(null);
                    try {
                      const res = await importParty.mutateAsync({ campaignId, campaignUrl: ddbUrl.trim() });
                      await party.refetch();
                      if (res.failed > 0) {
                        say(
                          `${res.imported} imported; ${res.failed} sheet${res.failed === 1 ? ' is' : 's are'} private on D&D Beyond — ` +
                          'ask the player to set Campaign or Public visibility, then summon again.',
                          'mark',
                        );
                      } else {
                        say(`${res.imported} imported — the party is assembled.`);
                      }
                    } catch (e) {
                      say(e instanceof Error ? e.message : 'The Beyond would not answer.', 'mark');
                    }
                  }}
                >
                  {importParty.isPending ? 'Summoning…' : 'Summon the party again'}
                </button>
              </div>
              {!cobalt.data?.set && (
                <div style={{ marginTop: 8, fontSize: 12.5, fontStyle: 'italic', color: 'var(--rf-ink-faint)' }}>
                  Summoning needs a seal on file.
                </div>
              )}
            </div>

            {note && (
              <div style={{ marginTop: 26, fontStyle: 'italic', color: noteTone === 'mark' ? 'var(--rf-mark)' : 'var(--rf-ink-2)' }}>
                {note}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function WorkingsPage() {
  return (
    <Suspense fallback={<main className="rf-page" />}>
      <Workings />
    </Suspense>
  );
}
