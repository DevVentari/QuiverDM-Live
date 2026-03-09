'use client';

import { useMemo } from 'react';
import type { WorldEntity, WorldRelationship } from '@prisma/client';

const TYPE_COLORS: Record<string, string> = {
  NPC: 'var(--color-amber-400, #fbbf24)',
  PC: 'var(--color-emerald-400, #34d399)',
  FACTION: 'var(--color-violet-400, #a78bfa)',
  LOCATION: 'var(--color-sky-400, #38bdf8)',
  ITEM: 'var(--color-orange-400, #fb923c)',
  EVENT: 'var(--color-rose-400, #fb7185)',
  ARC: 'var(--color-indigo-400, #818cf8)',
  THREAT: 'var(--color-red-500, #ef4444)',
  SECRET: 'var(--color-yellow-300, #fde047)',
  CUSTOM: 'var(--color-zinc-400, #a1a1aa)',
};

interface EntityGraphProps {
  entities: WorldEntity[];
  relationships: (WorldRelationship & { fromEntity: WorldEntity; toEntity: WorldEntity })[];
}

export function EntityGraph({ entities, relationships }: EntityGraphProps) {
  const nodes = useMemo(() => {
    return entities.map((entity, i) => ({
      id: entity.id,
      x: (i % 6) * 180 + 40,
      y: Math.floor(i / 6) * 120 + 40,
      label: entity.name,
      type: entity.type,
      color: TYPE_COLORS[entity.type] ?? TYPE_COLORS.CUSTOM,
    }));
  }, [entities]);

  const edges = useMemo(() => {
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromEntityId,
      target: rel.toEntityId,
      label: rel.type,
      strokeWidth: Math.max(1, Math.round(rel.strength * 4)),
    }));
  }, [relationships]);

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground italic">
        No entities to display. Seed the brain or ingest a session to populate the graph.
      </div>
    );
  }

  const svgWidth = Math.max(600, (Math.min(entities.length, 6)) * 180 + 80);
  const svgHeight = Math.max(300, (Math.ceil(entities.length / 6)) * 120 + 80);

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  return (
    <div className="overflow-auto rounded-lg border border-border bg-[oklch(0.1_0.02_260)]" data-testid="entity-graph">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(251,191,36,0.5)" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const from = nodeById.get(edge.source);
          const to = nodeById.get(edge.target);
          if (!from || !to) return null;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          return (
            <g key={edge.id}>
              <line
                x1={from.x + 50}
                y1={from.y + 16}
                x2={to.x + 50}
                y2={to.y + 16}
                stroke="rgba(251,191,36,0.4)"
                strokeWidth={edge.strokeWidth}
                markerEnd="url(#arrowhead)"
              />
              <text x={mx} y={my - 4} textAnchor="middle" fill="#64748b" fontSize="10">
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={100}
              height={32}
              rx={6}
              fill="rgba(15,15,30,0.85)"
              stroke={node.color}
              strokeWidth={2}
            />
            <text
              x={node.x + 50}
              y={node.y + 20}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="11"
              fontFamily="system-ui, sans-serif"
            >
              {node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-border">
        {Object.entries(TYPE_COLORS).map(([type, color]) => {
          const hasType = entities.some(e => e.type === type);
          if (!hasType) return null;
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-muted-foreground">{type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
