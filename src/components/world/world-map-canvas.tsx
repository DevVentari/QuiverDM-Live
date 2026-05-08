'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useViewport,
  addEdge,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  BackgroundVariant,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

function ViewportBackground({ url }: { url: string }) {
  const { x, y, zoom } = useViewport();
  return (
    <img
      src={url}
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
  const [pendingPlacement, setPendingPlacement] = useState<{ type: 'location' | 'note'; x: number; y: number } | null>(null);
  const [placingName, setPlacingName] = useState('');

  const utils = trpc.useUtils();

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

  if (!isLoading && !mapData) {
    return (
      <MapBackgroundPicker
        open
        onDone={() => {
          if (activeMapId) utils.worldMap.getMap.invalidate();
          else utils.worldMap.getOrCreateRoot.invalidate();
        }}
        campaignId={campaignId}
      />
    );
  }

  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-lg" />;
  }

  const ancestorPath = (mapData as unknown as { ancestorPath?: Array<{ mapId: string; name: string; entityId: string | null }> })?.ancestorPath ?? [];

  return (
    <div className="relative h-full w-full">
      {ancestorPath.length > 1 && (
        <MapBreadcrumb path={ancestorPath} slug={slug} />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        zoomOnScroll
        panOnDrag
        zoomOnPinch
        style={placingType ? { cursor: 'crosshair' } : undefined}
        className="bg-[var(--background)]"
      >
        {mapData?.backgroundUrl
          ? <ViewportBackground url={mapData.backgroundUrl} />
          : <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(240 20% 80% / 0.08)" />
        }
        <Controls className="!bg-card !border-border" />
        <MiniMap className="!bg-card !border-border" />
      </ReactFlow>
      <MapToolbar
        onPlaceLocation={() => setPlacingType('location')}
        onPlaceNote={() => setPlacingType('note')}
        onOpenSettings={() => setShowPicker(true)}
        onToggleFoundry={() => setShowFoundry(true)}
        mapId={mapData!.id}
        campaignId={campaignId}
      />
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
        <FoundryPanel
          campaignId={campaignId}
          onClose={() => setShowFoundry(false)}
        />
      )}
      {showPicker && (
        <MapBackgroundPicker
          open
          onDone={() => {
            setShowPicker(false);
            if (activeMapId) utils.worldMap.getMap.invalidate();
            else utils.worldMap.getOrCreateRoot.invalidate();
          }}
          campaignId={campaignId}
          mapId={mapData!.id}
        />
      )}
      {pendingPlacement && (
        <Dialog open onOpenChange={() => setPendingPlacement(null)}>
          <DialogContent className="max-w-xs border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-sm">
                {pendingPlacement.type === 'location' ? 'Location name' : 'Note'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Input
                autoFocus
                value={placingName}
                onChange={(e) => setPlacingName(e.target.value)}
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
