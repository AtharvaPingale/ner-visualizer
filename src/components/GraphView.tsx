import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { useStore } from "../store";
import { useFilteredEntities } from "../hooks/useFilteredEntities";
import { buildGraph, buildAdjacency, linkKey } from "../lib/graph";
import { entityColor } from "../lib/colors";
import type { GraphLink, GraphNode } from "../types";
import styles from "./GraphView.module.css";

type SimNode = GraphNode & SimulationNodeDatum;

export function GraphView() {
  const filtered = useFilteredEntities();
  const hoveredId = useStore((s) => s.hoveredNodeId);
  const focusedId = useStore((s) => s.focusedNodeId);
  const setHovered = useStore((s) => s.setHoveredNode);
  const setFocused = useStore((s) => s.setFocusedNode);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const innerRef = useRef<SVGGElement>(null);
  const nodeRefs = useRef<Map<string, SVGGElement>>(new Map());
  const edgeRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const simRef = useRef<Simulation<SimNode, GraphLink> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [size, setSize] = useState({ w: 600, h: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { nodes, links } = useMemo(() => {
    const prev = simRef.current?.nodes() ?? [];
    return buildGraph(filtered, prev);
  }, [filtered]);

  const adjacency = useMemo(() => buildAdjacency(links), [links]);

  // Resize observer
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ w: width, h: height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Simulation setup / update
  useEffect(() => {
    const simNodes = nodes as SimNode[];
    if (!simRef.current) {
      simRef.current = forceSimulation<SimNode, GraphLink>(simNodes)
        .force(
          "charge",
          forceManyBody<SimNode>().strength((d) => -300 - d.radius * 8)
        )
        .force(
          "link",
          forceLink<SimNode, GraphLink>(links)
            .id((d: SimNode) => d.id)
            .distance(120)
            .strength((l: GraphLink) => Math.min(0.6, 0.15 + Math.log(l.weight + 1) * 0.2))
        )
        .force("center", forceCenter(size.w / 2, size.h / 2))
        .force(
          "collide",
          forceCollide<SimNode>().radius((d) => d.radius + 6)
        )
        .alphaDecay(0.04)
        .on("tick", paint);
    } else {
      simRef.current.nodes(simNodes);
      const linkForce = simRef.current.force("link") as ReturnType<
        typeof forceLink<SimNode, GraphLink>
      >;
      linkForce.links(links);
      simRef.current.alpha(0.6).restart();
    }
    paint();
    return () => {
      // keep simulation alive across rebuilds; only stop on unmount via separate effect
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links]);

  // Stop simulation on unmount
  useEffect(
    () => () => {
      simRef.current?.stop();
      simRef.current = null;
    },
    []
  );

  // Update center when size changes
  useEffect(() => {
    if (!simRef.current) return;
    simRef.current.force("center", forceCenter(size.w / 2, size.h / 2));
    simRef.current.alpha(0.3).restart();
  }, [size.w, size.h]);

  // Zoom + pan
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .filter((event) => {
        // Block zoom/pan when initiating a drag on a node
        const target = event.target as Element | null;
        return !target?.closest("[data-node]");
      })
      .on("zoom", (event) => {
        if (innerRef.current) {
          innerRef.current.setAttribute("transform", event.transform.toString());
        }
      });
    zoomRef.current = z;
    svg.call(z);
    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  // Paint positions (called from tick)
  function paint() {
    const sim = simRef.current;
    if (!sim) return;
    const ns = sim.nodes() as SimNode[];
    for (const n of ns) {
      const g = nodeRefs.current.get(n.id);
      if (g && n.x != null && n.y != null) {
        g.setAttribute("transform", `translate(${n.x},${n.y})`);
      }
    }
    const linkForce = sim.force("link") as ReturnType<
      typeof forceLink<SimNode, GraphLink>
    > | null;
    const ls = linkForce ? (linkForce.links() as GraphLink[]) : [];
    for (const l of ls) {
      const s = l.source as SimNode;
      const t = l.target as SimNode;
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      // Perpendicular offset for a gentle curve
      const mx = (s.x + t.x) / 2 - dy * 0.12;
      const my = (s.y + t.y) / 2 + dx * 0.12;
      const path = edgeRefs.current.get(linkKey(l));
      if (path) {
        path.setAttribute("d", `M ${s.x} ${s.y} Q ${mx} ${my} ${t.x} ${t.y}`);
      }
    }
  }

  // Drag handling on nodes
  function handlePointerDown(e: React.PointerEvent<SVGGElement>, node: GraphNode) {
    e.stopPropagation();
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    const sim = simRef.current;
    if (sim) {
      sim.alphaTarget(0.3).restart();
      const n = node as SimNode;
      n.fx = n.x;
      n.fy = n.y;
    }
  }
  function handlePointerMove(e: React.PointerEvent<SVGGElement>, node: GraphNode) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const inner = innerRef.current;
    const svg = svgRef.current;
    if (!inner || !svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = inner.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const n = node as SimNode;
    n.fx = local.x;
    n.fy = local.y;
  }
  function handlePointerUp(e: React.PointerEvent<SVGGElement>, node: GraphNode) {
    const sim = simRef.current;
    if (sim) sim.alphaTarget(0);
    const n = node as SimNode;
    // Only unpin if not focused (focused nodes stay pinned)
    if (focusedId !== node.id) {
      n.fx = null;
      n.fy = null;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleNodeClick(node: GraphNode) {
    if (focusedId === node.id) {
      // unfocus + unpin
      setFocused(null);
      const n = node as SimNode;
      n.fx = null;
      n.fy = null;
    } else {
      setFocused(node.id);
      const n = node as SimNode;
      n.fx = n.x ?? null;
      n.fy = n.y ?? null;
    }
  }

  function handleBackgroundClick() {
    if (focusedId) {
      const sim = simRef.current;
      if (sim) {
        const fn = sim.nodes().find((n) => n.id === focusedId) as SimNode | undefined;
        if (fn) {
          fn.fx = null;
          fn.fy = null;
        }
      }
      setFocused(null);
    }
  }

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  }

  const activeId = hoveredId ?? focusedId;
  const neighbors = activeId ? adjacency.get(activeId) ?? new Set() : null;

  function nodeClass(node: GraphNode): string {
    const parts = [styles.node];
    if (focusedId === node.id) parts.push(styles.focused);
    if (activeId && activeId !== node.id && !neighbors?.has(node.id)) parts.push(styles.dim);
    if (activeId === node.id) parts.push(styles.active);
    return parts.join(" ");
  }

  function edgeClass(link: GraphLink): string {
    const a = typeof link.source === "string" ? link.source : link.source.id;
    const b = typeof link.target === "string" ? link.target : link.target.id;
    const parts = [styles.edge];
    if (activeId && activeId !== a && activeId !== b) parts.push(styles.dim);
    if (activeId === a || activeId === b) parts.push(styles.active);
    return parts.join(" ");
  }

  return (
    <div className={styles.view}>
      <div className={styles.titleRow}>
        <div className={styles.hint}>scroll to zoom · drag to pan · click node to focus</div>
        <button className={styles.resetBtn} onClick={resetZoom} title="Reset zoom">
          ⟲ Reset
        </button>
      </div>
      <div ref={containerRef} className={styles.canvas} onClick={handleBackgroundClick}>
        {nodes.length === 0 ? (
          <div className={styles.empty}>Run NER to populate the graph.</div>
        ) : null}
        <svg ref={svgRef} className={styles.svg} width={size.w} height={size.h}>
          <g ref={innerRef}>
            {links.map((l) => (
              <path
                key={linkKey(l)}
                ref={(el) => {
                  if (el) edgeRefs.current.set(linkKey(l), el);
                  else edgeRefs.current.delete(linkKey(l));
                }}
                className={edgeClass(l)}
                strokeWidth={1 + Math.log(l.weight + 1)}
                fill="none"
              />
            ))}
            {nodes.map((n) => (
              <g
                key={n.id}
                data-node="1"
                className={nodeClass(n)}
                ref={(el) => {
                  if (el) nodeRefs.current.set(n.id, el);
                  else nodeRefs.current.delete(n.id);
                }}
                onPointerDown={(e) => handlePointerDown(e, n)}
                onPointerMove={(e) => handlePointerMove(e, n)}
                onPointerUp={(e) => handlePointerUp(e, n)}
                onPointerCancel={(e) => handlePointerUp(e, n)}
                onMouseEnter={(e) => {
                  setHovered(n.id);
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    text: `${n.text} (${n.type}) — mentions: ${n.count}`,
                  });
                }}
                onMouseMove={(e) =>
                  setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    text: `${n.text} (${n.type}) — mentions: ${n.count}`,
                  })
                }
                onMouseLeave={() => {
                  setHovered(null);
                  setTooltip(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(n);
                }}
              >
                <circle r={n.radius} fill={entityColor(n.type)} stroke="#444" strokeWidth={1} />
                {(n.count > 1 || nodes.length <= 20 || activeId === n.id) && (
                  <text
                    className={styles.label}
                    y={n.radius + 12}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                  >
                    {n.text}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
        {tooltip && containerRef.current && (
          <div
            className={styles.tooltip}
            style={{
              left: tooltip.x - containerRef.current.getBoundingClientRect().left,
              top: tooltip.y - containerRef.current.getBoundingClientRect().top,
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
