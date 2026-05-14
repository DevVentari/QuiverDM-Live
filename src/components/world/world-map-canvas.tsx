'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useViewport,
  useReactFlow,
  addEdge,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { LocationNode } from './location-node';
import { NoteNode } from './note-node';
import { MapToolbar } from './map-toolbar';
import { LocationPanel } from './location-panel';
import { MapBackgroundPicker } from './map-background-picker';
import { MapBreadcrumb } from './map-breadcrumb';
import { FoundryPanel } from './foundry-panel';
import { DdbVttPanel } from './ddb-vtt-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { Map, Layers3, Network, Palette } from 'lucide-react';
import { WorldMapOverlay } from './world-map-overlay';
import { WorldMapStyleCard } from './world-map-style-card';
import { cn } from '@/lib/utils';
import {
  WORLD_MAP_PALETTES,
  WORLD_MAP_DEFAULT_PALETTE_KEY,
  WORLD_MAP_PALETTE_STORAGE_KEY,
  getWorldMapPalette,
  type WorldMapPaletteKey,
} from './world-map-palettes';

function ViewportBackground({ url }: { url: string }) {
  const { x, y, zoom } = useViewport();
  const { setViewport } = useReactFlow();
  const fitted = useRef(false);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (fitted.current) return;
      fitted.current = true;
      const img = e.currentTarget;
      const container = img.closest('.react-flow') as HTMLElement | null;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (!cw || !ch || !img.naturalWidth || !img.naturalHeight) return;
      const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const vx = (cw - img.naturalWidth * scale) / 2;
      const vy = (ch - img.naturalHeight * scale) / 2;
      setViewport({ x: vx, y: vy, zoom: scale });
    },
    [setViewport],
  );

  return (
    <img
      src={url}
      onLoad={handleLoad}
      draggable={false}
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

const nodeTypes: NodeTypes = {
  location: LocationNode,
  note: NoteNode,
};

interface WorldMapCanvasProps {
  slug: string;
}

export function WorldMapCanvas({ slug }: WorldMapCanvasProps) {
  const { campaignId } = useCampaign();
  const searchParams = useSearchParams();
  const activeMapId = searchParams.get('map');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [placingType, setPlacingType] = useState<'location' | 'note' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showFoundry, setShowFoundry] = useState(false);
  const [showDdb, setShowDdb] = useState(false);
  const [showStyleCard, setShowStyleCard] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<{ type: 'location' | 'note'; x: number; y: number } | null>(null);
  const [placingName, setPlacingName] = useState('');
  const [paletteKey, setPaletteKey] = useState<WorldMapPaletteKey>(WORLD_MAP_DEFAULT_PALETTE_KEY);

  const utils = trpc.useUtils();

  useEffect(() => {
    const stored = window.localStorage.getItem(WORLD_MAP_PALETTE_STORAGE_KEY) as WorldMapPaletteKey | null;
    if (stored) setPaletteKey(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORLD_MAP_PALETTE_STORAGE_KEY, paletteKey);
  }, [paletteKey]);

  const palette = useMemo(() => getWorldMapPalette(paletteKey), [paletteKey]);

  const paletteVars = useMemo(
    () =>
      ({
        '--wm-surface': palette.surface,
        '--wm-raised': palette.raised,
        '--wm-border': palette.border,
        '--wm-muted': palette.muted,
        '--wm-soft-text': palette.softText,
        '--wm-text': palette.text,
        '--wm-accent': palette.accent,
        '--wm-glow': palette.glow,
        '--wm-accent-trace': 'color-mix(in oklab, var(--wm-accent) 14%, transparent)',
        '--wm-accent-border': 'color-mix(in oklab, var(--wm-accent) 28%, transparent)',
      }) as CSSProperties,
    [palette],
  );

  const cyclePalette = useCallback(() => {
    const index = WORLD_MAP_PALETTES.findIndex((item) => item.key === paletteKey);
    const next = WORLD_MAP_PALETTES[(index + 1) % WORLD_MAP_PALETTES.length];
    setPaletteKey(next.key);
  }, [paletteKey]);

  const rootQuery = trpc.worldMap.getOrCreateRoot.useQuery(
    { campaignId },
    { enabled: !activeMapId }
  );
  const mapQuery = trpc.worldMap.getMap.useQuery(
    { mapId: activeMapId!, campaignId },
    { enabled: !!activeMapId }
  );

  const mapData = activeMapId ? mapQuery.data : rootQuery.data;
  const isLoading = activeMapId ? mapQuery.isLoading : rootQuery.isLoading;
  const mapsQuery = trpc.worldMap.listMaps.useQuery({ campaignId });

  const createLocationPin = trpc.worldMap.createLocationPin.useMutation({
    onSuccess: () => {
      if (activeMapId) utils.worldMap.getMap.invalidate();
      else utils.worldMap.getOrCreateRoot.invalidate();
    },
  });
  const createNotePin = trpc.worldMap.createNotePin.useMutation({
    onSuccess: () => {
      if (activeMapId) utils.worldMap.getMap.invalidate();
      else utils.worldMap.getOrCreateRoot.invalidate();
    },
  });
  const updatePinPosition = trpc.worldMap.updatePinPosition.useMutation();

  const syncNodes = useCallback(() => {
    if (!mapData?.pins) return;
    setNodes(
      mapData.pins.map((pin) => ({
        id: pin.id,
        type: pin.entity.type === 'NOTE' ? 'note' : 'location',
        position: { x: pin.x, y: pin.y },
        data: {
          entityId: pin.entity.id,
          label: pin.entity.name,
          type: pin.entity.type,
          lastEventAt: (pin as unknown as { lastEventAt?: string | null }).lastEventAt,
          unplaced: (pin as unknown as { unplaced?: boolean }).unplaced,
          source: 'dm' as const,
          onSelect: () => {
            setSelectedEntityId(pin.entity.id);
            setSelectedEntityName(pin.entity.name);
          },
        },
      }))
    );
  }, [mapData, setNodes]);

  useEffect(() => {
    syncNodes();
  }, [syncNodes]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!placingType || !mapData) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setPendingPlacement({ type: placingType, x, y });
      setPlacingName('');
      setPlacingType(null);
    },
    [placingType, mapData]
  );

  const confirmPlacement = useCallback(() => {
    if (!pendingPlacement || !mapData || !placingName.trim()) return;
    if (pendingPlacement.type === 'location') {
      createLocationPin.mutate({ mapId: mapData.id, campaignId, name: placingName.trim(), x: pendingPlacement.x, y: pendingPlacement.y });
    } else {
      createNotePin.mutate({ mapId: mapData.id, campaignId, content: placingName.trim(), x: pendingPlacement.x, y: pendingPlacement.y });
    }
    setPendingPlacement(null);
    setPlacingName('');
  }, [pendingPlacement, mapData, placingName, campaignId, createLocationPin, createNotePin]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      updatePinPosition.mutate({ pinId: node.id, campaignId, x: node.position.x, y: node.position.y });
    },
    [campaignId, updatePinPosition]
  );

  const ancestorPath = (mapData as unknown as { ancestorPath?: Array<{ mapId: string; name: string; entityId: string | null }> })?.ancestorPath ?? [];

  if (!isLoading && !mapData) {
    return (
      <div className="relative h-full">
        <MapBackgroundPicker
          open
          onDone={() => {
            if (activeMapId) utils.worldMap.getMap.invalidate();
            else utils.worldMap.getOrCreateRoot.invalidate();
          }}
          campaignId={campaignId}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full" style={paletteVars}>
      {/* Floating top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto">
          {ancestorPath.length > 1 ? (
            <MapBreadcrumb path={ancestorPath} slug={slug} />
          ) : (
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-display backdrop-blur-md"
              style={{
                borderColor: 'var(--wm-border)',
                background: 'color-mix(in oklab, var(--wm-surface) 72%, black)',
                color: 'var(--wm-text)',
              }}
            >
              <Map className="h-3.5 w-3.5" style={{ color: 'var(--wm-accent)' }} />
              {mapData?.name ?? 'World Map'}
            </div>
          )}
        </div>
        <div
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur-md"
          style={{
            borderColor: 'var(--wm-border)',
            background: 'color-mix(in oklab, var(--wm-surface) 82%, black)',
            color: 'var(--wm-soft-text)',
          }}
        >
          <Layers3 className="h-3 w-3" style={{ color: 'var(--wm-accent)' }} />
          <span>{mapsQuery.data?.length ?? 0}</span>
          <span className="mx-1 opacity-30">·</span>
          <Network className="h-3 w-3" style={{ color: 'var(--wm-accent)' }} />
          <span>{mapData?.pins?.length ?? 0} pins</span>
          <button
            type="button"
            onClick={() => setShowStyleCard((open) => !open)}
            className="ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors hover:border-[var(--wm-accent-border)] hover:text-[var(--wm-accent)]"
            style={{
              borderColor: 'var(--wm-border)',
              background: 'var(--wm-raised)',
              color: 'var(--wm-text)',
            }}
          >
            <Palette className="h-3 w-3" />
            {palette.label}
          </button>
        </div>
      </div>

      {/* Full-height canvas */}
      {isLoading ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : (
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={onPaneClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView={!mapData?.backgroundUrl}
            zoomOnScroll
            panOnDrag
            zoomOnPinch
            className={cn('h-full', placingType && 'cursor-crosshair')}
            style={{
              cursor: placingType ? 'crosshair' : undefined,
              background: 'linear-gradient(180deg, color-mix(in oklab, var(--wm-surface) 82%, black), color-mix(in oklab, var(--wm-surface) 94%, black))',
            }}
          >
            {mapData?.backgroundUrl
              ? <ViewportBackground url={mapData.backgroundUrl} />
              : <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="color-mix(in_oklab, var(--wm-accent) 12%, transparent)" />
            }
            <Controls
              className="!bottom-5 !left-[4.5rem] !top-auto !rounded-2xl !border !border-[var(--wm-border)] !text-[var(--wm-soft-text)] !backdrop-blur-md"
              style={{ background: 'color-mix(in oklab, var(--wm-surface) 85%, black)' }}
            />
            <MiniMap
              className="!rounded-2xl !border !border-[var(--wm-border)] !backdrop-blur-md"
              style={{ background: 'color-mix(in oklab, var(--wm-surface) 85%, black)' }}
            />
          </ReactFlow>
        </ReactFlowProvider>
      )}

      {/* Overlay cards */}
      {!isLoading && mapData && (
        <WorldMapOverlay
          campaignId={campaignId}
          slug={slug}
          selectedEntityId={selectedEntityId}
          selectedEntityName={selectedEntityName}
          locationPins={mapData.pins ?? []}
          onSelectLocation={(entityId, name) => {
            setSelectedEntityId(entityId);
            setSelectedEntityName(name);
          }}
        />
      )}

      {/* Floating toolbar */}
      {!isLoading && (
        <MapToolbar
          onPlaceLocation={() => setPlacingType('location')}
          onPlaceNote={() => setPlacingType('note')}
          onOpenSettings={() => setShowPicker(true)}
          onToggleFoundry={() => setShowFoundry(true)}
          onToggleDdb={() => setShowDdb(true)}
          mapId={mapData!.id}
          campaignId={campaignId}
        />
      )}

      {showStyleCard && (
        <WorldMapStyleCard
          currentPaletteKey={paletteKey}
          onSelectPalette={setPaletteKey}
          onCyclePalette={cyclePalette}
          onClose={() => setShowStyleCard(false)}
        />
      )}

      {/* Panels & dialogs */}
      {selectedEntityId && (
        <LocationPanel
          entityId={selectedEntityId}
          entityName={selectedEntityName}
          campaignId={campaignId}
          mapId={mapData!.id}
          slug={slug}
          onClose={() => { setSelectedEntityId(null); setSelectedEntityName(''); }}
        />
      )}
      {showFoundry && (
        <FoundryPanel campaignId={campaignId} onClose={() => setShowFoundry(false)} />
      )}
      {showDdb && (
        <DdbVttPanel campaignId={campaignId} onClose={() => setShowDdb(false)} />
      )}
      {showPicker && (
        <MapBackgroundPicker
          open
          onDone={() => {
            setShowPicker(false);
            if (activeMapId) utils.worldMap.getMap.invalidate();
            else utils.worldMap.getOrCreateRoot.invalidate();
            utils.worldMap.listMaps.invalidate();
            utils.worldMap.listBackgroundSources.invalidate();
          }}
          campaignId={campaignId}
          mapId={mapData!.id}
        />
      )}
      {pendingPlacement && (
        <Dialog open onOpenChange={() => setPendingPlacement(null)}>
          <DialogContent
            className="max-w-xs"
            style={{
              borderColor: 'var(--wm-border)',
              background: 'linear-gradient(180deg, color-mix(in oklab, var(--wm-surface) 94%, white 6%), var(--wm-surface))',
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-display text-sm" style={{ color: 'var(--wm-text)' }}>
                {pendingPlacement.type === 'location' ? 'Location name' : 'Field note'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Input
                autoFocus
                value={placingName}
                onChange={(e) => setPlacingName(e.target.value)}
                className="placeholder:opacity-60"
                style={{
                  borderColor: 'var(--wm-border)',
                  background: 'color-mix(in oklab, var(--wm-surface) 84%, black)',
                  color: 'var(--wm-text)',
                }}
                placeholder={pendingPlacement.type === 'location' ? 'e.g. Ravenloft Castle' : 'Enter note…'}
                onKeyDown={(e) => e.key === 'Enter' && confirmPlacement()}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setPendingPlacement(null)}>Cancel</Button>
                <Button size="sm" disabled={!placingName.trim()} onClick={confirmPlacement}>
                  {pendingPlacement.type === 'location' ? 'Place' : 'Add note'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
