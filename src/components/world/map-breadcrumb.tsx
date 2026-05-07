'use client';
interface BreadcrumbSegment { mapId: string; name: string; entityId: string | null; }
interface MapBreadcrumbProps { path: BreadcrumbSegment[]; slug: string; }
export function MapBreadcrumb(_props: MapBreadcrumbProps) { return null; }
