'use client';

import { useState } from 'react';
import { MessageSquare, Copy, FileDown, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StyleSelector } from './style-selector';
import { RecapSection } from './recap-section';
import type { RecapStyle, RecapStatus } from '@prisma/client';

interface RecapSectionData {
  key: string;
  title: string;
  content: string;
}

interface RecapViewerProps {
  recapId: string;
  sections: RecapSectionData[];
  activeStyle: RecapStyle;
  status: RecapStatus;
  bestStatusPerStyle?: Partial<Record<RecapStyle, RecapStatus>>;
  isDirty: boolean;
  isApproving: boolean;
  isSharing: boolean;
  regenningKeys: Set<string>;
  onStyleChange: (style: RecapStyle) => void;
  onSectionChange: (key: string, content: string) => void;
  onApprove: (status: 'REVIEWED' | 'QUICK_FIRE') => void;
  onShare: () => void;
  onCopyMarkdown: () => void;
  onExportMarkdown: () => void;
  onRegenSection: (key: string, dmNote: string) => void;
}

export function RecapViewer({
  recapId: _recapId,
  sections,
  activeStyle,
  status,
  bestStatusPerStyle,
  isDirty,
  isApproving,
  isSharing,
  regenningKeys,
  onStyleChange,
  onSectionChange,
  onApprove,
  onShare,
  onCopyMarkdown,
  onExportMarkdown,
  onRegenSection,
}: RecapViewerProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [regenNote, setRegenNote] = useState('');

  const showApproveBar = status === 'AUTO_GENERATED' || isDirty;
  const showShareButton = ['REVIEWED', 'QUICK_FIRE'].includes(status) && !isDirty;

  return (
    <div
      className="rounded-sm p-6"
      style={{
        background: 'hsl(35 10% 10% / 0.7)',
        border: '1px solid hsl(35 15% 18% / 0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Style selector */}
      <div className="mb-4">
        <StyleSelector
          activeStyle={activeStyle}
          onChange={onStyleChange}
          bestStatus={bestStatusPerStyle}
        />
      </div>

      <div
        className="my-4 h-px"
        style={{ background: 'linear-gradient(to right, transparent, hsl(35 40% 30% / 0.4), transparent)' }}
      />

      {/* Sections */}
      <div className="group divide-y divide-[hsl(35_10%_18%_/_0.3)]">
        {sections.map((s) => (
          <RecapSection
            key={s.key}
            sectionKey={s.key}
            title={s.title}
            content={s.content}
            isEditing={editingKey === s.key}
            isRegenerating={regenningKeys.has(s.key)}
            regenNote={editingKey === s.key ? regenNote : ''}
            onEdit={() => {
              setEditingKey(s.key);
              setRegenNote('');
            }}
            onCancelEdit={() => setEditingKey(null)}
            onContentChange={(content) => onSectionChange(s.key, content)}
            onRegenNoteChange={setRegenNote}
            onRegenerate={() => {
              onRegenSection(s.key, regenNote);
              setEditingKey(null);
              setRegenNote('');
            }}
          />
        ))}
      </div>

      <div
        className="my-4 h-px"
        style={{ background: 'linear-gradient(to right, transparent, hsl(35 40% 30% / 0.4), transparent)' }}
      />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {showApproveBar && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setEditingKey(null);
                onApprove('REVIEWED');
              }}
              disabled={isApproving}
              style={
                status === 'REVIEWED'
                  ? { borderColor: 'hsl(35 60% 35%)', color: 'hsl(35 70% 58%)' }
                  : {}
              }
            >
              <CheckCircle className="h-3 w-3" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setEditingKey(null);
                onApprove('QUICK_FIRE');
              }}
              disabled={isApproving}
              style={
                status === 'QUICK_FIRE'
                  ? { borderColor: 'hsl(50 80% 40%)', color: 'hsl(50 80% 62%)' }
                  : {}
              }
            >
              <Zap className="h-3 w-3" /> Quick-fire
            </Button>
          </>
        )}
        {showShareButton && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onShare}
            disabled={isSharing}
          >
            <MessageSquare className="h-3 w-3" /> Share to Discord
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            onClick={onCopyMarkdown}
          >
            <Copy className="h-3 w-3" /> Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            onClick={onExportMarkdown}
          >
            <FileDown className="h-3 w-3" /> Export
          </Button>
        </div>
      </div>
    </div>
  );
}
