'use client';
import { useState } from 'react';
import { NOTE_LABEL, NOTE_TINT, type SceneNote } from './note-constants';

const mono = 'font-[family-name:var(--qd-font-mono)]';

export function NoteCard({
  note,
  onSave,
  onDelete,
  onRefine,
  refining,
}: {
  note: SceneNote;
  onSave: (patch: { body: string }) => void;
  onDelete: () => void;
  onRefine: (instruction: string) => void;
  refining: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const d = (note.data ?? {}) as {
    skill?: string;
    dc?: number | { skill: string; dc: number };
    condition?: string;
    reveal?: string;
  };

  return (
    <div
      className="rounded-qd-md border border-qd-faint p-3"
      style={{ borderLeft: `2px solid ${NOTE_TINT[note.type]}` }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`${mono} text-[8px] uppercase tracking-[0.1em]`}
          style={{ color: NOTE_TINT[note.type] }}
        >
          {NOTE_LABEL[note.type]}
        </span>
        <span className="ml-auto flex gap-2">
          {(note.type === 'read_aloud' || note.type === 'lore' || note.type === 'secret') && (
            <>
              <button
                disabled={refining}
                onClick={() => onRefine('colder')}
                className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text"
              >
                ✦ colder
              </button>
              <button
                disabled={refining}
                onClick={() => onRefine('shorter')}
                className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text"
              >
                ✦ shorter
              </button>
            </>
          )}
          <button
            onClick={() => {
              setDraft(note.body);
              setEditing((e) => !e);
            }}
            className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="text-[10px] text-qd-ink-faint hover:text-qd-danger-bright"
          >
            ✕
          </button>
        </span>
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full rounded-qd-md border border-qd-accent bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 text-sm text-qd-ink focus:outline-none"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => {
                onSave({ body: draft });
                setEditing(false);
              }}
              className="rounded-qd-md bg-qd-accent px-3 py-1 text-[12px] font-bold text-qd-on-accent"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-qd-md border border-qd-strong px-3 py-1 text-[12px] text-qd-ink-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`text-qd-body-sm leading-relaxed ${
            note.type === 'read_aloud'
              ? 'font-qd-display italic text-qd-ink'
              : 'text-qd-ink-2'
          }`}
        >
          {note.body}
        </p>
      )}

      {note.type === 'check' && d.skill && (
        <div className={`${mono} mt-1.5 text-[11px] text-qd-success`}>
          {d.skill} DC {String(d.dc)}
        </div>
      )}

      {note.type === 'trigger' && (
        <div className="mt-1.5 text-[11px] text-qd-ink-2">
          {d.condition && (
            <div>
              <span className="text-qd-ink-faint">if</span> {d.condition}
            </div>
          )}
          {d.dc && typeof d.dc === 'object' && (
            <div className="text-qd-success">
              {d.dc.skill} DC {d.dc.dc}
            </div>
          )}
          {d.reveal && (
            <div className="mt-0.5 italic text-qd-accent-text">"{d.reveal}"</div>
          )}
        </div>
      )}
    </div>
  );
}
