'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useReactFlow,
  type NodeTypes,
  type Node,
  ReactFlowProvider,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { trpc } from '@/lib/trpc';
import { Loader2, ChevronDown, ImagePlus } from 'lucide-react';
import { CanonPinNode, type CanonPinData } from './canon-pin-node';
import { BriefingPinNode, type BriefingPinData } from './briefing-pin-node';
import { BriefingPinCard } from './briefing-pin-card';
import type { BriefingCard } from '@/lib/briefing-types';

const nodeTypes: NodeTypes = {
  'canon-pin': CanonPinNode,
  'briefing-pin': BriefingPinNode,
};

function ViewportBackground({ url }: { url: string }) {
  const { x, y, zoom } = useViewport();
  return (
    <img
      src={url}
      draggable={false}
      alt=""
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transformOrigin: '0 0',
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        zIndex: -1,
        pointerEvents: 'none',
        userSelect: 'none',
        maxWidth: 'none',
      }}
    />
  );
}

interface PrepMapInnerProps {
  campaignId: string;
  cards: BriefingCard[];
  onCardChange: (card: BriefingCard) => void;
  activeMapId: string;
}

function PrepMapInner({ campaignId, cards, onCardChange, activeMapId }: PrepMapInnerProps) {
  const { setCenter, fitView } = useReactFlow();
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  const mapQuery = trpc.worldMap.getMap.useQuery(
    { mapId: activeMapId, campaignId },
    { enabled: !!activeMapId }
  );

  const mapData = mapQuery.data;
  const bgUrl = mapData?.backgroundUrl ?? null;

  const spatialCards = cards.filter(
    (c) => c.mapCoords && c.mapCoords.mapId === activeMapId && c.status !== 'dismissed'
  );

  const handlePinFocus = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card?.mapCoords) return;
    setFocusedCardId(cardId);
    setCenter(card.mapCoords.x + 20, card.mapCoords.y + 20, { zoom: 1.8, duration: 600 });
  }, [cards, setCenter]);

  useEffect(() => {
    if (!mapData) return;

    const canonNodes: Node[] = (mapData.pins ?? [])
      .filter((pin) => !spatialCards.some((c) => c.entityId === pin.entityId))
      .map((pin) => ({
        id: `canon-${pin.id}`,
        type: 'canon-pin' as const,
        position: { x: pin.x, y: pin.y },
        draggable: false,
        selectable: false,
        data: { entity: pin.entity } satisfies CanonPinData,
      }));

    const briefingNodes: Node[] = spatialCards.map((card) => ({
      id: `briefing-${card.id}`,
      type: 'briefing-pin' as const,
      position: { x: card.mapCoords!.x, y: card.mapCoords!.y },
      draggable: true,
      data: {
        card,
        focused: focusedCardId === card.id,
        onFocus: handlePinFocus,
      } satisfies BriefingPinData,
    }));

    setNodes([...canonNodes, ...briefingNodes]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData, cards, focusedCardId, activeMapId]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith('briefing-')) return;
      const cardId = node.id.replace('briefing-', '');
      const card = cards.find((c) => c.id === cardId);
      if (!card || !card.mapCoords) return;
      onCardChange({
        ...card,
        mapCoords: { ...card.mapCoords, x: node.position.x, y: node.position.y, placement: 'proposed' },
      });
    },
    [cards, onCardChange]
  );

  function handleClose() {
    setFocusedCardId(null);
    fitView({ duration: 400, padding: 0.2 });
  }

  const focusedCard = focusedCardId ? cards.find((c) => c.id === focusedCardId) : null;

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        style={{ background: 'oklch(0.1 0.005 265)' }}
      >
        {bgUrl && <ViewportBackground url={bgUrl} />}
      </ReactFlow>

      {focusedCard && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ marginTop: '-60px', marginLeft: '40px' }}
        >
          <BriefingPinCard
            card={focusedCard}
            onChange={(updated) => {
              onCardChange(updated);
              if (updated.status === 'accepted' || updated.status === 'dismissed') handleClose();
            }}
            onClose={handleClose}
          />
        </div>
      )}

      {mapQuery.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'oklch(0.1 0.005 265)' }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'oklch(0.7 0.16 55)' }} />
        </div>
      )}
    </div>
  );
}

interface PrepMapCanvasProps {
  campaignId: string;
  cards: BriefingCard[];
  onCardChange: (card: BriefingCard) => void;
  onCardDrop: (card: BriefingCard, x: number, y: number, mapId: string) => void;
}

export function PrepMapCanvas({ campaignId, cards, onCardChange, onCardDrop }: PrepMapCanvasProps) {
  const mapsQuery = trpc.worldMap.listMaps.useQuery({ campaignId });
  const maps = mapsQuery.data ?? [];
  const rootMap = maps.find((m) => !m.parentLocationId);
  const [activeMapId, setActiveMapId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createRoot = trpc.worldMap.createRoot.useMutation({
    onSuccess: () => mapsQuery.refetch(),
  });
  const uploadMapBackground = trpc.worldMap.uploadMapBackground.useMutation({
    onSuccess: () => mapsQuery.refetch(),
  });

  useEffect(() => {
    if (rootMap && !activeMapId) setActiveMapId(rootMap.id);
  }, [rootMap, activeMapId]);

  async function handleMapImageFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/map-background', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json() as { url: string };

      let mapId = rootMap?.id;
      if (!mapId) {
        const created = await createRoot.mutateAsync({
          campaignId,
          name: 'World Map',
          backgroundType: 'UPLOADED',
          backgroundUrl: url,
        });
        mapId = created.id;
        setActiveMapId(created.id);
      } else {
        await uploadMapBackground.mutateAsync({ mapId, campaignId, backgroundUrl: url });
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('briefing-card-id');
    if (!cardId || !activeMapId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    onCardDrop(card, x, y, activeMapId);
  }

  if (!activeMapId && !mapsQuery.isLoading) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer group"
        style={{ background: 'oklch(0.1 0.005 265)' }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleMapImageFile(f);
          }}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'oklch(0.7 0.16 55)' }} />
        ) : (
          <>
            <ImagePlus className="h-8 w-8 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: 'oklch(0.7 0.16 55)' }} />
            <p className="text-xs font-[family-name:var(--q-font-display)] tracking-widest uppercase" style={{ color: 'oklch(0.4 0.01 270)' }}>
              Click to set world map
            </p>
          </>
        )}
      </div>
    );
  }

  if (!activeMapId) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'oklch(0.1 0.005 265)' }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'oklch(0.7 0.16 55)' }} />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full flex flex-col"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleMapImageFile(f);
        }}
      />

      {/* Replace background button */}
      <button
        className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-sm opacity-0 hover:opacity-100 transition-opacity"
        style={{ background: 'oklch(0.16 0.008 265 / 0.85)', border: '1px solid oklch(0.3 0.01 270)' }}
        onClick={() => fileInputRef.current?.click()}
        title="Set map background"
      >
        {uploading
          ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'oklch(0.7 0.16 55)' }} />
          : <ImagePlus className="h-3 w-3" style={{ color: 'oklch(0.6 0.01 270)' }} />
        }
      </button>

      {maps.length > 1 && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <div className="relative">
            <select
              value={activeMapId}
              onChange={(e) => setActiveMapId(e.target.value)}
              className="appearance-none text-[11px] pl-2 pr-6 py-1 rounded-sm border outline-none cursor-pointer"
              style={{
                background: 'oklch(0.16 0.008 265 / 0.9)',
                borderColor: 'oklch(0.3 0.01 270)',
                color: 'oklch(0.7 0.01 270)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.parentLocationId ? `↳ ${m.name}` : m.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" style={{ color: 'oklch(0.5 0.01 270)' }} />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ReactFlowProvider>
          <PrepMapInner
            campaignId={campaignId}
            cards={cards}
            onCardChange={onCardChange}
            activeMapId={activeMapId}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
