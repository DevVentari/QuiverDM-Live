'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useViewport,
  useReactFlow,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LocationNode } from '@/components/world/location-node';
import { NoteNode } from '@/components/world/note-node';
import { TokenNode } from './token-node';
import { ZoomSlider } from '@/components/world/zoom-slider';

const nodeTypes: NodeTypes = { location: LocationNode, note: NoteNode, token: TokenNode };

/** Fit-to-view background image rendered in flow space (mirrors world-map-canvas). */
function ViewportBackground({ url }: { url: string }) {
  const { x, y, zoom } = useViewport();
  const { setViewport } = useReactFlow();
  const fitted = useRef(false);
  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (fitted.current) return;
    fitted.current = true;
    const img = e.currentTarget;
    const container = img.closest('.react-flow') as HTMLElement | null;
    if (!container) return;
    const cw = container.clientWidth, ch = container.clientHeight;
    if (!cw || !ch || !img.naturalWidth || !img.naturalHeight) return;
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    setViewport({ x: (cw - img.naturalWidth * scale) / 2, y: (ch - img.naturalHeight * scale) / 2, zoom: scale });
  }, [setViewport]);
  return (
    <img src={url} alt="" onLoad={handleLoad} draggable={false}
      style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0',
        transform: `translate(${x}px, ${y}px) scale(${zoom})`, zIndex: -1,
        pointerEvents: 'none', userSelect: 'none', maxWidth: 'none', opacity: 0.85 }} />
  );
}

export interface VttMarker {
  id: string;
  x: number;
  y: number;
  type: 'location' | 'note' | 'token';
  data: Record<string, unknown>;
}

interface VttCanvasProps {
  backgroundUrl?: string | null;
  markers: VttMarker[];
  onMarkerDragEnd?: (id: string, x: number, y: number) => void;
  onPaneClick?: (x: number, y: number) => void;
  isDM: boolean;
  overlays?: ReactNode;
  toolbar?: ReactNode;
}

function VttCanvasInner({ backgroundUrl, markers, onMarkerDragEnd, onPaneClick, isDM, overlays, toolbar }: VttCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  useEffect(() => {
    setNodes(markers.map((m) => ({ id: m.id, type: m.type, position: { x: m.x, y: m.y }, data: m.data, draggable: isDM })));
  }, [markers, isDM, setNodes]);

  const handleDragStop = useCallback(
    (_: unknown, node: { id: string; position: { x: number; y: number } }) =>
      onMarkerDragEnd?.(node.id, node.position.x, node.position.y),
    [onMarkerDragEnd],
  );

  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onPaneClick) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onPaneClick(p.x, p.y);
    },
    [onPaneClick, screenToFlowPosition],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={handleDragStop}
        onPaneClick={handlePaneClick}
        fitView={!backgroundUrl}
        minZoom={0.1}
        maxZoom={4}
        zoomOnScroll
        panOnDrag
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
        className="h-full"
        style={{ background: 'var(--qd-bg)' }}
      >
        {backgroundUrl
          ? <ViewportBackground url={backgroundUrl} />
          : <Background variant={BackgroundVariant.Lines} gap={40} size={1} color="rgba(255,235,205,.045)" />}
        {/* Hand-rolled HUD: zoom-in / zoom-out / fit-view */}
        <div className="absolute top-3 left-3 z-[6] flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoomIn()}
            className="h-8 w-8 grid place-items-center rounded-qd-sm border border-qd-strong bg-black/50 text-qd-ink-2 hover:text-qd-ink"
            aria-label="Zoom in"
          >+</button>
          <button
            type="button"
            onClick={() => zoomOut()}
            className="h-8 w-8 grid place-items-center rounded-qd-sm border border-qd-strong bg-black/50 text-qd-ink-2 hover:text-qd-ink"
            aria-label="Zoom out"
          >−</button>
          <button
            type="button"
            onClick={() => fitView()}
            className="h-8 w-8 grid place-items-center rounded-qd-sm border border-qd-strong bg-black/50 text-qd-ink-2 hover:text-qd-ink"
            aria-label="Fit view"
          >⤢</button>
        </div>
      </ReactFlow>
      <ZoomSlider />
      {overlays}
      {toolbar}
    </div>
  );
}

export function VttCanvas(props: VttCanvasProps) {
  return (
    <ReactFlowProvider>
      <VttCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
