import type { Entity, GraphLink, GraphNode } from "../types";

const PROXIMITY = 80;

export function entityId(e: Entity): string {
  return `${e.text}::${e.type}`;
}

export function buildGraph(
  entities: Entity[],
  previous: GraphNode[]
): { nodes: GraphNode[]; links: GraphLink[] } {
  const prevById = new Map(previous.map((n) => [n.id, n]));
  const nodeMap = new Map<string, GraphNode>();

  for (const e of entities) {
    const id = entityId(e);
    const existing = nodeMap.get(id);
    if (existing) {
      existing.count++;
      continue;
    }
    const prev = prevById.get(id);
    nodeMap.set(id, {
      id,
      text: e.text,
      type: e.type,
      count: 1,
      radius: 8,
      x: prev?.x,
      y: prev?.y,
      vx: prev?.vx,
      vy: prev?.vy,
      fx: prev?.fx ?? null,
      fy: prev?.fy ?? null,
    });
  }
  for (const n of nodeMap.values()) n.radius = 8 + 3 * Math.sqrt(n.count);

  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const edgeMap = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const gap = sorted[j].start - sorted[i].end;
      if (gap > PROXIMITY) break;
      if (gap < 0) continue;
      const aId = entityId(sorted[i]);
      const bId = entityId(sorted[j]);
      if (aId === bId) continue;
      const [a, b] = [aId, bId].sort();
      const key = `${a}|${b}`;
      edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
    }
  }

  const links: GraphLink[] = [];
  for (const [key, weight] of edgeMap) {
    const [a, b] = key.split("|");
    links.push({ source: a, target: b, weight });
  }

  return { nodes: [...nodeMap.values()], links };
}

export function linkKey(link: GraphLink): string {
  const a = typeof link.source === "string" ? link.source : link.source.id;
  const b = typeof link.target === "string" ? link.target : link.target.id;
  return `${a}|${b}`;
}

export function buildAdjacency(links: GraphLink[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const l of links) {
    const a = typeof l.source === "string" ? l.source : l.source.id;
    const b = typeof l.target === "string" ? l.target : l.target.id;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  return adj;
}
