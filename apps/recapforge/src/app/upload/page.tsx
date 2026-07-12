'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Masthead } from '@/components/manuscript/Masthead';
import { parseCraigFilename } from '@/lib/craig';
import { extractAudioFromZip, guessAudioMime } from '@/lib/zip';

const DM_NAME = 'The DM';

type TrackState = 'uploading' | 'done' | 'error';
interface TrackRow {
  filename: string;
  size: number;
  username: string | null;
  characterName: string | null;
  isDM: boolean;
  state: TrackState;
  error?: string;
  // True once the naming has actually persisted (assignSpeaker resolved) —
  // separate from characterName so the "Set the type" gate can't open on
  // an optimistic UI update alone.
  confirmed: boolean;
}

function formatSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${Math.round(bytes / 1_000_000)} MB` : `${Math.round(bytes / 1000)} KB`;
}

function ComposingRoom() {
  const router = useRouter();
  const params = useSearchParams();
  const campaignId = params.get('campaign') ?? '';
  const sessionId = params.get('session') ?? '';
  const [uploadGroupId] = useState(() => crypto.randomUUID());
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [setting, setSetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initiate = trpc.forgeSessions.initiate.useMutation();
  const processMut = trpc.forgeSessions.process.useMutation();
  const assign = trpc.forgeSessions.assignSpeaker.useMutation();
  const party = trpc.forgeCampaign.party.useQuery({ campaignId }, { enabled: !!campaignId });
  const mappings = trpc.forgeSessions.mappings.useQuery({ campaignId }, { enabled: !!campaignId });

  const knownVoice = useMemo(() => {
    const map = new Map<string, { characterName: string; isDM: boolean }>();
    for (const m of mappings.data ?? []) map.set(m.speakerLabel, { characterName: m.characterName, isDM: m.isDM });
    return map;
  }, [mappings.data]);

  async function deliverFiles(incoming: File[]) {
    // Expand any Craig zips client-side first.
    const expanded: File[] = [];
    for (const f of incoming) {
      if (/\.zip$/i.test(f.name)) expanded.push(...(await extractAudioFromZip(f)));
      else expanded.push(f);
    }
    for (const file of expanded) {
      const { username } = parseCraigFilename(file.name);
      const remembered = username ? knownVoice.get(username) : undefined;
      const row: TrackRow = {
        filename: file.name,
        size: file.size,
        username,
        characterName: remembered?.characterName ?? null,
        isDM: remembered?.isDM ?? false,
        state: 'uploading',
        confirmed: !!remembered,
      };
      setTracks((t) => [...t, row]);
      try {
        const init = await initiate.mutateAsync({
          campaignId, sessionId,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || guessAudioMime(file.name),
          uploadGroupId,
          speakerTag: username ?? undefined,
        });
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(init.uploadUrl, { method: 'POST', body: form });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        setTracks((t) => t.map((r) => (r.filename === file.name ? { ...r, state: 'done' } : r)));
      } catch (e) {
        setTracks((t) => t.map((r) =>
          r.filename === file.name
            ? { ...r, state: 'error', error: e instanceof Error ? e.message : 'illegible — offer it again' }
            : r,
        ));
      }
    }
  }

  async function nameVoice(filename: string, characterName: string, isDM: boolean) {
    const row = tracks.find((t) => t.filename === filename);
    if (!row) return;
    // Optimistic UI update first: the buttons for this row must disappear
    // immediately so a rapid next click (naming the next voice) can't land
    // on the same still-unnamed row while this assignment is in flight.
    // `confirmed` stays false until the write actually persists, so the
    // "Set the type" gate can't open on the optimistic update alone.
    setTracks((t) => t.map((r) => (r.filename === filename ? { ...r, characterName, isDM, confirmed: false } : r)));
    try {
      await assign.mutateAsync({
        campaignId,
        speakerLabel: row.username ?? row.filename,
        characterName,
        isDM,
      });
      setTracks((t) => t.map((r) => (r.filename === filename ? { ...r, confirmed: true } : r)));
    } catch {
      // Roll back on failure so the row goes back to offering choices.
      setTracks((t) => t.map((r) => (r.filename === filename ? { ...r, characterName: null, isDM: false, confirmed: false } : r)));
    }
  }

  const doneTracks = tracks.filter((t) => t.state === 'done');
  const ready = doneTracks.length > 0 && doneTracks.every((t) => t.characterName && t.confirmed) &&
    tracks.every((t) => t.state !== 'uploading');

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 880 }}>
        <div className="rf-paper">
          <Masthead right={<span className="rf-masthead__meta">{doneTracks.length} of {tracks.length || '—'} tracks received</span>}>
            <Link href="/" className="rf-masthead__crumb">Ledger → new session</Link>
          </Masthead>

          <div className="rf-compose__body">
            <h1 className="rf-compose__title">Deliver the recording</h1>
            <div className="rf-compose__sub">
              One Craig track per voice — or drop the whole Craig zip. Each must bear a name before the scribe begins.
            </div>

            <div
              className="rf-dropzone"
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void deliverFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <div className="rf-dropzone__lead">Drop the tracks here</div>
              <div className="rf-dropzone__hint">FLAC, WAV, or the Craig zip — the composing room keeps them in order</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".flac,.wav,.mp3,.ogg,.opus,.m4a,.aac,.webm,.zip,audio/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) void deliverFiles(Array.from(e.target.files));
                  e.target.value = '';
                }}
              />
            </div>

            {tracks.length > 0 && (
              <>
                <div className="rf-track__cols">
                  <span /><span>Track</span><span>Voice</span>
                  <span style={{ textAlign: 'right' }}>Size</span>
                </div>
                {tracks.map((t) => {
                  const err = t.state === 'error';
                  return (
                    <div
                      key={t.filename}
                      className="rf-track__row"
                      style={{ background: err ? 'rgba(163,59,42,.05)' : !t.characterName && t.state === 'done' ? 'rgba(122,46,33,.04)' : 'transparent' }}
                    >
                      <span className="rf-track__mark" style={{ color: err ? 'var(--rf-mark)' : t.state === 'uploading' ? 'var(--rf-ink-muted)' : 'var(--rf-ink)' }}>
                        {err ? '✕' : t.state === 'uploading' ? '…' : '✓'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="rf-track__file">{t.filename}</div>
                        <div className="rf-track__note" style={{ color: err ? 'var(--rf-mark)' : 'var(--rf-ink-faint)' }}>
                          {err ? t.error : t.state === 'uploading' ? 'arriving…' : 'received'}
                        </div>
                      </div>
                      <div className="rf-track__assign-cell">
                        {t.characterName ? (
                          <span className="rf-track__assign">{t.isDM ? `${t.characterName} — the DM` : t.characterName}</span>
                        ) : t.state === 'done' ? (
                          <div className="rf-track__choices">
                            {(party.data ?? []).map((p) => (
                              <button key={p.id} className="rf-btn rf-btn--ghost" onClick={() => void nameVoice(t.filename, p.characterName, false)}>
                                {p.characterName}
                              </button>
                            ))}
                            <button className="rf-btn rf-btn--ghost" onClick={() => void nameVoice(t.filename, DM_NAME, true)}>
                              {DM_NAME}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <span className="rf-track__size">{formatSize(t.size)}</span>
                    </div>
                  );
                })}
              </>
            )}

            <div className="rf-compose__foot">
              <span className="rf-compose__setnote" style={{ color: ready ? 'var(--rf-ink)' : 'var(--rf-mark)' }}>
                {tracks.length === 0
                  ? 'The composing room stands ready.'
                  : ready
                    ? 'Every voice bears a name. The scribe may begin.'
                    : 'Every voice must bear a name before type is set.'}
              </span>
              <button
                className="rf-btn rf-btn--solid"
                style={{ padding: '11px 22px' }}
                disabled={!ready || setting}
                onClick={async () => {
                  setSetting(true);
                  try {
                    await processMut.mutateAsync({ campaignId, sessionId, uploadGroupId });
                    router.push('/');
                  } finally {
                    setSetting(false);
                  }
                }}
              >
                Set the type →
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ComposingRoomPage() {
  return (
    <Suspense fallback={<main className="rf-page" />}>
      <ComposingRoom />
    </Suspense>
  );
}
