'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorldEntity, WorldRelationship } from '@prisma/client';

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; mini: string }> = {
  NPC:      { bg: '#1c1408', border: '#fbbf24', text: '#fde68a', mini: '#fbbf24' },
  PC:       { bg: '#0a1f1a', border: '#34d399', text: '#6ee7b7', mini: '#34d399' },
  FACTION:  { bg: '#160e2a', border: '#a78bfa', text: '#c4b5fd', mini: '#a78bfa' },
  LOCATION: { bg: '#0a1e14', border: '#4ade80', text: '#86efac', mini: '#4ade80' },
  ITEM:     { bg: '#1c0f08', border: '#fb923c', text: '#fed7aa', mini: '#fb923c' },
  EVENT:    { bg: '#080e1c', border: '#60a5fa', text: '#bfdbfe', mini: '#60a5fa' },
  ARC:      { bg: '#160820', border: '#e879f9', text: '#f5d0fe', mini: '#e879f9' },
  THREAT:   { bg: '#1c0808', border: '#f87171', text: '#fecaca', mini: '#f87171' },
  SECRET:   { bg: '#1a1808', border: '#fde047', text: '#fef08a', mini: '#fde047' },
  CUSTOM:   { bg: '#111827', border: '#6b7280', text: '#9ca3af', mini: '#6b7280' },
};

const STATUS_OPACITY: Record<string, number> = {
  active: 1,
  dormant: 0.6,
  destroyed: 0.35,
  resolved: 0.4,
};

type EntityNodeData = {
  label: string;
  type: string;
  status: string;
  onClick?: () => void;
};

function EntityNode({ data }: NodeProps<Node<EntityNodeData>>) {
  const colors = TYPE_COLORS[data.type] ?? TYPE_COLORS.CUSTOM;
  const opacity = STATUS_OPACITY[data.status] ?? 1;

  return (
    <div
      onClick={data.onClick}
      style={{
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: 8,
        padding: '6px 12px',
        cursor: 'pointer',
        opacity,
        minWidth: 120,
        maxWidth: 180,
        boxShadow: `0 0 8px ${colors.border}22`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: colors.border, width: 6, height: 6 }} />
      <div style={{ fontSize: 10, color: colors.border, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        {data.type}
      </div>
      <div
        style={{
          fontSize: 12,
          color: colors.text,
          fontWeight: 600,
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}
      >
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: colors.border, width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

interface EntityGraphProps {
  entities: WorldEntity[];
  relationships: (WorldRelationship & { fromEntity: WorldEntity; toEntity: WorldEntity })[];
  onEntityClick?: (entityId: string) => void;
}

function layoutNodes(entities: WorldEntity[]): Record<string, { x: number; y: number }> {
  // Group by type, then arrange each group in a cluster
  const groups: Record<string, WorldEntity[]> = {};
  for (const e of entities) {
    (groups[e.type] ??= []).push(e);
  }

  const typeKeys = Object.keys(groups);
  const positions: Record<string, { x: number; y: number }> = {};

  // Place each type group in a rough circle, entities within group in a sub-circle
  const groupCount = typeKeys.length;
  typeKeys.forEach((type, groupIdx) => {
    const groupAngle = (groupIdx / groupCount) * 2 * Math.PI - Math.PI / 2;
    const groupRadius = Math.max(250, groupCount * 80);
    const cx = Math.cos(groupAngle) * groupRadius;
    const cy = Math.sin(groupAngle) * groupRadius;

    const members = groups[type];
    const memberCount = members.length;
    members.forEach((entity, memberIdx) => {
      if (memberCount === 1) {
        positions[entity.id] = { x: cx, y: cy };
      } else {
        const memberAngle = (memberIdx / memberCount) * 2 * Math.PI;
        const memberRadius = Math.max(60, memberCount * 18);
        positions[entity.id] = {
          x: cx + Math.cos(memberAngle) * memberRadius,
          y: cy + Math.sin(memberAngle) * memberRadius,
        };
      }
    });
  });

  return positions;
}

export function EntityGraph({ entities, relationships, onEntityClick }: EntityGraphProps) {
  const positions = useMemo(() => layoutNodes(entities), [entities]);

  const initialNodes = useMemo<Node<EntityNodeData>[]>(() =>
    entities.map((entity) => ({
      id: entity.id,
      type: 'entity',
      position: positions[entity.id] ?? { x: 0, y: 0 },
      data: {
        label: entity.name,
        type: entity.type,
        status: entity.status,
        onClick: onEntityClick ? () => onEntityClick(entity.id) : undefined,
      },
    })),
    [entities, positions, onEntityClick]
  );

  const initialEdges = useMemo<Edge[]>(() =>
    relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromEntityId,
      target: rel.toEntityId,
      label: rel.type,
      type: 'smoothstep',
      animated: rel.strength > 0.7,
      style: {
        stroke: 'rgba(251,191,36,0.35)',
        strokeWidth: Math.max(1, Math.round(rel.strength * 3)),
      },
      labelStyle: { fill: '#64748b', fontSize: 9 },
      labelBgStyle: { fill: 'rgba(10,10,20,0.8)' },
      markerEnd: { type: 'arrowclosed' as const, color: 'rgba(251,191,36,0.5)', width: 12, height: 12 },
    })),
    [relationships]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(() => {
    // handled via data.onClick on the node component itself
  }, []);

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground italic">
        No entities to display. Seed the brain or ingest a session to populate the graph.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border overflow-hidden"
      style={{ height: 520, background: 'oklch(0.08 0.015 260)' }}
      data-testid="entity-graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Controls
          style={{ background: 'oklch(0.12 0.01 260)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <MiniMap
          style={{ background: 'oklch(0.1 0.01 260)', border: '1px solid rgba(255,255,255,0.08)' }}
          nodeColor={(node) => {
            const colors = TYPE_COLORS[(node.data as EntityNodeData).type] ?? TYPE_COLORS.CUSTOM;
            return colors.mini;
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
