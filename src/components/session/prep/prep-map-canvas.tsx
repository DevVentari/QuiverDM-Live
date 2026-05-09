'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  useViewport,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { trpc } from '@/lib/trpc';
import { BriefingPinComponent, type BriefingPinNode } from './briefing-pin';
import type { BriefingCard } from '@/lib/briefing-types';

// ── Canon pin node ────────────────────────────────────────────

type CanonPinData = { entityName: string };
type CanonPinNode = Node<CanonPinData, 'canonPin'>;

const CanonPin = React.memo(function CanonPin({ data }: { data: CanonPinData }) {
  return (
    <div
      title={data.entityName}
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: '1.5px solid oklch(0.32 0.01 270)',
        background: 'oklch(0.2 0.01 270 / 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontFamily: 'var(--q-font-display, serif)',
        fontWeight: 700,
        color: 'oklch(0.48 0.01 270)',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {data.entityName.slice(0, 1).toUpperCase()}
    </div>
  );
});
CanonPin.displayName = 'CanonPin';

const NODE_TYPES: NodeTypes = {
  canonPin: CanonPin as unknown as NodeTypes[string],
  briefingPin: BriefingPinComponent as unknown as NodeTypes[string],
};

// ── Viewport-tracking background image ───────────────────────

function ViewportBackground({ url }: { url: string }) {
  const { x, y, zoom } = useViewport();
  return (
    <img
      src={url}
      draggable={false}
      alt=""
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

// ── Inner component (requires ReactFlowProvider) ──────────────

interface PrepMapCanvasInnerProps {
  campaignId: string;
  spatialCards: BriefingCard[];
  focusedCardId: string | null;
  onPinFocus: (cardId: string) => void;
  placingCardId: string | null;
  onPlaceCard: (cardId: string, x: number, y: number, mapId: string) => void;
}

function PrepMapCanvasInner({
  campaignId,
  spatialCards,
  focusedCardId,
  onPinFocus,
  placingCardId,
  onPlaceCard,
}: PrepMapCanvasInnerProps) {
  const rf = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  const mapQuery = trpc.worldMap.getOrCreateRoot.useQuery(
    { campaignId },
    { staleTime: 60_000 }
  );
  const map = mapQuery.data ?? null;

  const canonNodes = useMemo<CanonPinNode[]>(() => {
    if (!map) return [];
    return map.pins.map((pin) => ({
      id: `canon-${pin.id}`,
      type: 'canonPin' as const,
      position: { x: pin.x, y: pin.y },
      data: { entityName: pin.entity?.name ?? '?' },
      draggable: false,
      selectable: false,
    }));
  }, [map]);

  const briefingNodes = useMemo<BriefingPinNode[]>(() => {
    return spatialCards
      .filter((c) => c.mapCoords)
      .map((card) => ({
        id: `briefing-${card.id}`,
        type: 'briefingPin' as const,
        position: { x: card.mapCoords!.x, y: card.mapCoords!.y },
        data: {
          cardId: card.id,
          cardType: card.type,
          entityName: card.entityName,
          placement: card.mapCoords!.placement,
          cardStatus: card.status,
          isFocused: card.id === focusedCardId,
        },
      }));
  }, [spatialCards, focusedCardId]);

  const allNodes = useMemo<Node[]>(() => [...canonNodes, ...briefingNodes], [canonNodes, briefingNodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(allNodes);

  useEffect(() => {
    setNodes(allNodes);
  }, [allNodes, setNodes]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'briefingPin') {
        const cardId = (node.data as { cardId: string }).cardId;
        onPinFocus(cardId);
        rf.setCenter(node.position.x, node.position.y, { zoom: 2.5, duration: 600 });
      }
    },
    [onPinFocus, rf]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!placingCardId || !map) return;
      const el = containerRef.current;
      if (!el) return;
      const bounds = el.getBoundingClientRect();
      const vp = rf.getViewport();
      const x = (event.clientX - bounds.left - vp.x) / vp.zoom;
      const y = (event.clientY - bounds.top - vp.y) / vp.zoom;
      onPlaceCard(placingCardId, x, y, map.id);
    },
    [placingCardId, map, rf, onPlaceCard]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      data-testid="prep-map-canvas"
      style={{
        cursor: placingCardId ? 'crosshair' : 'default',
        background: 'oklch(0.10 0.005 265)',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={NODE_TYPES}
        minZoom={0.15}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll
      >
        {map?.backgroundUrl && <ViewportBackground url={map.backgroundUrl} />}
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="oklch(0.22 0.005 265)"
        />
      </ReactFlow>

      {mapQuery.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs" style={{ color: 'oklch(0.38 0.01 270)' }}>
            Loading map…
          </span>
        </div>
      )}

      {!mapQuery.isLoading && !map && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-center px-8 leading-relaxed" style={{ color: 'oklch(0.38 0.01 270)' }}>
            No world map yet.
            <br />
            Brain cards appear in the rail on the right.
          </p>
        </div>
      )}

      {placingCardId && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full pointer-events-none"
          style={{
            background: 'oklch(0.7 0.16 55)',
            color: 'oklch(0.12 0.005 265)',
          }}
        >
          Click the map to place this card
        </div>
      )}
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────

export interface PrepMapCanvasProps {
  campaignId: string;
  spatialCards: BriefingCard[];
  focusedCardId: string | null;
  onPinFocus: (cardId: string) => void;
  placingCardId: string | null;
  onPlaceCard: (cardId: string, x: number, y: number, mapId: string) => void;
}

export function PrepMapCanvas(props: PrepMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <PrepMapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
