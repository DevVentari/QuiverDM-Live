'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

type Step = 'name' | 'cobalt' | 'party';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('name');
  const [campaignName, setCampaignName] = useState('');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [cobalt, setCobalt] = useState('');
  const [ddbUrl, setDdbUrl] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createCampaign = trpc.forgeCampaign.create.useMutation();
  const setCobaltKey = trpc.forgeKeys.setCobalt.useMutation();
  const addMember = trpc.forgeCampaign.addPartyMember.useMutation();
  const importParty = trpc.forgeCampaign.importParty.useMutation();
  const party = trpc.forgeCampaign.party.useQuery(
    { campaignId: campaignId ?? '' },
    { enabled: !!campaignId },
  );

  const stepNo = step === 'name' ? 'I' : step === 'cobalt' ? 'II' : 'III';

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 720 }}>
        <div className="rf-paper" style={{ padding: '48px 52px 56px' }}>
          <div className="rf-eyebrow rf-eyebrow--accent">Founding the press · step {stepNo} of III</div>

          {step === 'name' && (
            <>
              <h1 className="rf-compose__title" style={{ marginTop: 14 }}>Name the chronicle</h1>
              <div className="rf-compose__sub">Every campaign begins as an empty ledger with a good name.</div>
              <label htmlFor="campaign-name" className="rf-eyebrow" style={{ display: 'block', marginTop: 28 }}>
                Campaign name
              </label>
              <input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: 8, padding: '12px 14px',
                  font: 'inherit', fontSize: 19, background: 'transparent',
                  border: 'none', borderBottom: '2px solid var(--rf-rule)', outline: 'none',
                }}
              />
              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="rf-btn rf-btn--solid"
                  disabled={!campaignName.trim() || createCampaign.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      const c = await createCampaign.mutateAsync({ name: campaignName.trim() });
                      setCampaignId(c.id);
                      setStep('cobalt');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'The press jammed — try again.');
                    }
                  }}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {step === 'cobalt' && (
            <>
              <h1 className="rf-compose__title" style={{ marginTop: 14 }}>The Beyond seal (optional)</h1>
              <div className="rf-compose__sub">
                Paste your D&D Beyond CobaltSession cookie to import the party straight from your campaign page.
                You can add it later in Workings.
              </div>
              <textarea
                aria-label="Cobalt cookie"
                value={cobalt}
                onChange={(e) => setCobalt(e.target.value)}
                rows={3}
                style={{
                  display: 'block', width: '100%', marginTop: 24, padding: 12,
                  fontFamily: 'var(--rf-font-mono)', fontSize: 12,
                  background: 'transparent', border: '1px dashed var(--rf-rule-dot)', outline: 'none',
                }}
              />
              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between' }}>
                <button className="rf-btn rf-btn--ghost" onClick={() => setStep('party')}>Skip</button>
                <button
                  className="rf-btn rf-btn--solid"
                  disabled={cobalt.trim().length < 20 || setCobaltKey.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await setCobaltKey.mutateAsync({ cookie: cobalt.trim() });
                      setStep('party');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'That seal would not take.');
                    }
                  }}
                >
                  Keep the seal →
                </button>
              </div>
            </>
          )}

          {step === 'party' && campaignId && (
            <>
              <h1 className="rf-compose__title" style={{ marginTop: 14 }}>Assemble the party</h1>
              <div className="rf-compose__sub">Name the heroes so the scribe knows every voice at the table.</div>

              <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  placeholder="Player"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: '10px 12px', font: 'inherit', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rf-rule-dot)', outline: 'none' }}
                />
                <input
                  placeholder="Character"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  style={{ flex: 1, minWidth: 140, padding: '10px 12px', font: 'inherit', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rf-rule-dot)', outline: 'none' }}
                />
                <button
                  className="rf-btn rf-btn--ghost"
                  disabled={!playerName.trim() || !characterName.trim() || addMember.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await addMember.mutateAsync({ campaignId, playerName: playerName.trim(), characterName: characterName.trim() });
                      setPlayerName('');
                      setCharacterName('');
                      await party.refetch();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'That name would not take — try again.');
                    }
                  }}
                >
                  Add
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                {(party.data ?? []).map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px dotted var(--rf-rule-dot)' }}>
                    <span style={{ fontWeight: 600 }}>{p.characterName}</span>
                    <span style={{ color: 'var(--rf-ink-muted)', fontStyle: 'italic' }}>{p.name}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="…or paste a D&D Beyond campaign URL"
                  value={ddbUrl}
                  onChange={(e) => setDdbUrl(e.target.value)}
                  style={{ flex: 1, minWidth: 220, padding: '10px 12px', fontFamily: 'var(--rf-font-mono)', fontSize: 12, background: 'transparent', border: '1px dashed var(--rf-rule-dot)', outline: 'none' }}
                />
                <button
                  className="rf-btn rf-btn--ghost"
                  disabled={!ddbUrl.trim() || importParty.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await importParty.mutateAsync({ campaignId, campaignUrl: ddbUrl.trim() });
                      await party.refetch();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'The Beyond would not answer.');
                    }
                  }}
                >
                  {importParty.isPending ? 'Summoning…' : 'Import'}
                </button>
              </div>

              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="rf-btn rf-btn--solid" onClick={() => router.push('/')}>
                  Open the ledger →
                </button>
              </div>
            </>
          )}

          {error && (
            <div style={{ marginTop: 18, fontStyle: 'italic', color: 'var(--rf-mark)' }}>{error}</div>
          )}
        </div>
      </div>
    </main>
  );
}
