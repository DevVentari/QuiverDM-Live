'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { WorldEntity, WorldRelationship } from '@prisma/client';
import { Search, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// SSR-safe import — canvas won't render server-side
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const TYPE_COLORS: Record<string, string> = {
  NPC:      '#fbbf24',
  PC:       '#34d399',
  FACTION:  '#a78bfa',
  LOCATION: '#4ade80',
  ITEM:     '#fb923c',
  EVENT:    '#60a5fa',
  ARC:      '#e879f9',
  THREAT:   '#f87171',
  SECRET:   '#fde047',
  CUSTOM:   '#6b7280',
};

const STATUS_OPACITY: Record<string, number> = {
  active: 1,
  dormant: 0.5,
  destroyed: 0.25,
  resolved: 0.35,
};

type RelWithEntities = WorldRelationship & {
  fromEntity: WorldEntity;
  toEntity: WorldEntity;
};

interface EntityGraphProps {
  entities: WorldEntity[];
  relationships: RelWithEntities[];
  onEntityClick?: (entityId: string) => void;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  status: string;
  val: number; // node size = degree count
  color: string;
  opacity: number;
  // runtime-injected by force-graph
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  strength: number;
}

export function EntityGraph({ entities, relationships, onEntityClick }: EntityGraphProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [search, setSearch] = useState('');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Degree map for node sizing
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const rel of relationships) {
      map.set(rel.fromEntityId, (map.get(rel.fromEntityId) ?? 0) + 1);
      map.set(rel.toEntityId, (map.get(rel.toEntityId) ?? 0) + 1);
    }
    return map;
  }, [relationships]);

  // Build graph data from visible nodes
  const graphData = useMemo(() => {
    const nodeSet = visibleIds;
    const nodes: GraphNode[] = entities
      .filter(e => nodeSet.has(e.id))
      .map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status,
        val: Math.max(2, (degreeMap.get(e.id) ?? 0) * 1.5 + 3),
        color: TYPE_COLORS[e.type] ?? TYPE_COLORS.CUSTOM,
        opacity: STATUS_OPACITY[e.status] ?? 1,
      }));

    const links: GraphLink[] = relationships
      .filter(r => nodeSet.has(r.fromEntityId) && nodeSet.has(r.toEntityId))
      .map(r => ({
        source: r.fromEntityId,
        target: r.toEntityId,
        label: r.type,
        strength: r.strength,
      }));

    return { nodes, links };
  }, [entities, relationships, visibleIds, degreeMap]);

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return entities
      .filter(e => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, entities]);

  function addEntityToGraph(entityId: string) {
    setVisibleIds(prev => {
      const next = new Set(prev);
      next.add(entityId);
      return next;
    });
    setSearch('');
    setSelectedId(entityId);
  }

  function expandEntity(entityId: string) {
    const connected = relationships
      .filter(r => r.fromEntityId === entityId || r.toEntityId === entityId)
      .flatMap(r => [r.fromEntityId, r.toEntityId]);
    setVisibleIds(prev => {
      const next = new Set(prev);
      for (const id of connected) next.add(id);
      return next;
    });
  }

  function removeEntity(entityId: string) {
    setVisibleIds(prev => {
      const next = new Set(prev);
      next.delete(entityId);
      return next;
    });
    if (selectedId === entityId) setSelectedId(null);
  }

  function clearGraph() {
    setVisibleIds(new Set());
    setSelectedId(null);
  }

  const selectedEntity = useMemo(
    () => entities.find(e => e.id === selectedId) ?? null,
    [entities, selectedId]
  );

  const selectedRelationships = useMemo(
    () => selectedId
      ? relationships.filter(r => r.fromEntityId === selectedId || r.toEntityId === selectedId)
      : [],
    [relationships, selectedId]
  );

  const connectedButHidden = useMemo(
    () => selectedId
      ? selectedRelationships
          .flatMap(r => [r.fromEntityId, r.toEntityId])
          .filter(id => id !== selectedId && !visibleIds.has(id))
          .length
      : 0,
    [selectedId, selectedRelationships, visibleIds]
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedId(node.id);
  }, []);

  const handleNodeRightClick = useCallback((node: GraphNode) => {
    expandEntity(node.id);
  }, [relationships]); // eslint-disable-line react-hooks/exhaustive-deps

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = node.val;
    const isSelected = node.id === selectedId;
    const isHovered = node.id === hoveredId;
    const opacity = node.opacity;

    ctx.globalAlpha = opacity;

    // Glow for selected/hovered
    if (isSelected || isHovered) {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = isSelected ? 16 : 8;
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x as number, node.y as number, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected
      ? node.color
      : `${node.color}55`;
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Label
    const fontSize = Math.max(8, Math.min(12, r * 1.2));
    if (globalScale > 0.4 || isSelected || isHovered) {
      ctx.font = `${isSelected ? 600 : 400} ${fontSize}px "Bricolage Grotesque", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name;
      const textY = (node.y as number) + r + fontSize * 0.8;

      // Text bg
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(8,8,20,0.75)';
      ctx.fillRect(
        (node.x as number) - tw / 2 - 2,
        textY - fontSize * 0.65,
        tw + 4,
        fontSize * 1.3
      );

      ctx.fillStyle = isSelected ? '#fff' : node.color;
      ctx.fillText(label, node.x as number, textY);
    }

    ctx.globalAlpha = 1;
  }, [selectedId, hoveredId]);

  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as unknown as GraphNode;
    const target = link.target as unknown as GraphNode;
    if (!source?.x || !target?.x) return;

    ctx.globalAlpha = 0.35 + link.strength * 0.4;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(0.5, link.strength * 2);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y as number);
    ctx.lineTo(target.x, target.y as number);
    ctx.stroke();

    // Label at midpoint if zoomed in
    ctx.globalAlpha = 0.6;
    const mx = (source.x + target.x) / 2;
    const my = ((source.y as number) + (target.y as number)) / 2;
    ctx.font = '7px system-ui';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(link.label, mx, my);
    ctx.globalAlpha = 1;
  }, []);

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground italic">
        No entities to display. Seed the brain or ingest a session to populate the graph.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="entity-graph">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={`Search ${entities.length} entities to add to graph…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No matches</div>
            ) : (
              searchResults.map(e => (
                <button
                  key={e.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors"
                  onClick={() => addEntityToGraph(e.id)}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TYPE_COLORS[e.type] ?? TYPE_COLORS.CUSTOM }}
                  />
                  <span className="flex-1 text-left truncate">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{e.type}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {/* Graph canvas */}
        <div
          ref={containerRef}
          className="relative flex-1 rounded-lg border border-border overflow-hidden"
          style={{ height: 480, background: 'oklch(0.08 0.015 260)' }}
        >
          {visibleIds.size === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">Search for an entity above to start exploring</p>
              <p className="text-xs opacity-60">Right-click a node to expand its connections</p>
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData as any}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="transparent"
              nodeCanvasObject={paintNode as any}
              nodeCanvasObjectMode={() => 'replace'}
              linkCanvasObject={paintLink as any}
              linkCanvasObjectMode={() => 'replace'}
              onNodeClick={handleNodeClick as any}
              onNodeRightClick={handleNodeRightClick as any}
              onNodeHover={(node: any) => setHoveredId(node?.id ?? null)}
              nodeLabel={() => ''}
              cooldownTicks={120}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          )}

          {/* Controls */}
          {visibleIds.size > 0 && (
            <div className="absolute bottom-3 right-3 flex flex-col gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 bg-background/80"
                onClick={() => graphRef.current?.zoom(1.5, 300)}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 bg-background/80"
                onClick={() => graphRef.current?.zoom(0.67, 300)}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 bg-background/80"
                onClick={() => graphRef.current?.zoomToFit(400)}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Node count */}
          {visibleIds.size > 0 && (
            <div className="absolute top-2 left-2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-1 rounded">
                {visibleIds.size} nodes · {graphData.links.length} edges
              </span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={clearGraph}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Selection panel */}
        {selectedEntity && (
          <div className="w-64 shrink-0 rounded-lg border border-border bg-card/40 p-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 480 }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-overline text-muted-foreground">{selectedEntity.type}</p>
                <p className="font-semibold text-sm leading-tight mt-1">{selectedEntity.name}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="section-rule" />

            <div className="flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ borderColor: `${TYPE_COLORS[selectedEntity.type]}44`, color: TYPE_COLORS[selectedEntity.type] }}
              >
                {selectedEntity.status}
              </Badge>
            </div>

            {selectedEntity.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{selectedEntity.description}</p>
            )}

            {connectedButHidden > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => expandEntity(selectedEntity.id)}
              >
                Expand {connectedButHidden} hidden connection{connectedButHidden !== 1 ? 's' : ''}
              </Button>
            )}

            {selectedRelationships.length > 0 && (
              <div className="space-y-2">
                <p className="label-overline text-muted-foreground">Connections</p>
                <div className="section-rule" />
                {selectedRelationships.map(rel => {
                  const other = rel.fromEntityId === selectedId ? rel.toEntity : rel.fromEntity;
                  const isVisible = visibleIds.has(other.id);
                  return (
                    <div key={rel.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        className={cn(
                          'flex-1 text-left text-xs truncate',
                          isVisible ? 'text-foreground hover:text-primary' : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => isVisible ? setSelectedId(other.id) : addEntityToGraph(other.id)}
                      >
                        {other.name}
                      </button>
                      <span className="text-[9px] text-muted-foreground/60 uppercase shrink-0">{rel.type}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="section-rule" />

            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => onEntityClick?.(selectedEntity.id)}
              >
                Open detail page
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-destructive hover:text-destructive"
                onClick={() => removeEntity(selectedEntity.id)}
              >
                Remove from graph
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Type legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, color]) => {
          const count = entities.filter(e => e.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              type="button"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              onClick={() => {
                const first = entities.find(e => e.type === type && !visibleIds.has(e.id));
                if (first) addEntityToGraph(first.id);
              }}
              title={`Add a ${type} to graph`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-muted-foreground">{type} ({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
