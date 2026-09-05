"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import generatedGraphData from "../data/network.json";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
  { ssr: false }
);

export type GraphNode = {
  id: string;
  name: string;
  role?: string;
  group?: number;
  val?: number;
  color?: string;
  desc?: string;
  orcid?: string;

  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

export type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  value?: number;
  works?: {
    putCode?: number;
    title?: string;
    year?: string;
    journal?: string;
    doi?: string;
    url?: string;
  }[];
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

interface MapProps {
  centerPerson: string;
  onNodeSelect?: (node: GraphNode, sharedWorks?: any[]) => void;
  initialDepth?: number;
}

const graphData = generatedGraphData as GraphData;

/**
 * Convert the generated network data into a graph where
 * every link uses the node's ORCID/id.
 *
 * network.json:
 *
 * node:
 * {
 *   id: "0000-0002-3529-9247",
 *   name: "Dr. Erin Cameron"
 * }
 *
 * link:
 * {
 *   source: "frances kilbertus",
 *   target: "sarah newbery"
 * }
 *
 * becomes:
 *
 * source: "ORCID_OF_FRANCES"
 * target: "ORCID_OF_SARAH"
 */
function normalizeGraphData(data: GraphData): GraphData {
  const nameToId = new Map<string, string>();
  const idSet = new Set<string>();

  for (const node of data.nodes) {
    idSet.add(node.id);

    if (node.name) {
      nameToId.set(
        node.name.trim().toLowerCase(),
        node.id
      );
    }
  }

  const resolvePersonId = (
    value: string | GraphNode
  ): string | null => {
    if (typeof value !== "string") {
      return value.id;
    }

    // Already an ORCID / node ID.
    if (idSet.has(value)) {
      return value;
    }

    // Link endpoint is a person's name.
    const normalizedName = value
      .trim()
      .toLowerCase();

    return nameToId.get(normalizedName) ?? null;
  };

  const normalizedLinks: GraphLink[] = [];

  for (const link of data.links) {
    const source = resolvePersonId(link.source);
    const target = resolvePersonId(link.target);

    if (!source || !target) {
      console.warn(
        `Could not resolve network link:`,
        link.source,
        "→",
        link.target
      );

      continue;
    }

    normalizedLinks.push({
      ...link,
      source,
      target,
    });
  }

  return {
    nodes: data.nodes,
    links: normalizedLinks,
  };
}

// Normalize ONCE when the module loads.
// No React hook is needed here.
const normalizedGraphData =
  normalizeGraphData(graphData);

/**
 * Escape text before it is injected into the
 * browser's floating tooltip (linkLabel renders
 * as innerHTML), so titles with special
 * characters display correctly and safely.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A link can represent more than one shared
 * work between the same two people. Build a
 * single display string:
 *
 * One work:
 * "Title (2026)"
 *
 * Multiple works:
 * "Title A (2026) + 2 more"
 */
function getLinkTitleLabel(
  link: GraphLink
): string {
  const works = link.works ?? [];

  if (works.length === 0) {
    return "";
  }

  const first = works[0];
  const firstTitle =
    first.title ?? "Untitled work";
  const firstLabel = first.year
    ? `${firstTitle} (${first.year})`
    : firstTitle;

  if (works.length === 1) {
    return firstLabel;
  }

  return `${firstLabel} + ${works.length - 1} more`;
}

/**
 * Full HTML tooltip content for a link,
 * listing every shared work when there is
 * more than one.
 */
function getLinkTooltipHtml(
  link: GraphLink
): string {
  const works = link.works ?? [];

  if (works.length === 0) {
    return "";
  }

  if (works.length === 1) {
    const work = works[0];
    const title = escapeHtml(
      work.title ?? "Untitled work"
    );

    const meta = [work.journal, work.year]
      .filter(Boolean)
      .join(" · ");

    return meta
      ? `${title}<br/><span style="opacity:0.75">${escapeHtml(
          meta
        )}</span>`
      : title;
  }

  return works
    .map((work, index) => {
      const title = escapeHtml(
        work.title ?? "Untitled work"
      );

      return `${index + 1}. ${title}${
        work.year
          ? ` (${escapeHtml(work.year)})`
          : ""
      }`;
    })
    .join("<br/>");
}

export default function CollaborationMap({
  centerPerson,
  onNodeSelect,
  initialDepth = 1,
}: MapProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const fgRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState({
    width: 800,
    height: 600,
  });

  const [maxDepth, setMaxDepth] =
    useState(initialDepth);

  /**
   * Build the visible graph based on the
   * selected network depth.
   *
   * Depth 1:
   * Erin → direct collaborators
   *
   * Depth 2:
   * Erin → collaborators → their collaborators
   *
   * Depth 3:
   * One additional layer.
   */
  const visibleGraph = useMemo<GraphData>(() => {
    const selectedPerson = normalizedGraphData.nodes.find(
      (node) =>
        node.name.trim().toLowerCase() ===
        centerPerson.trim().toLowerCase()
    );

    if (!selectedPerson) {
      console.error(
        `Could not find "${centerPerson}" in network.json`
      );

      return {
        nodes: [],
        links: [],
      };
    }

    const rootId = selectedPerson.id;

    const adjacency =
      new Map<string, Set<string>>();

    // Create an adjacency set for every node.
    for (const node of normalizedGraphData.nodes) {
      adjacency.set(node.id, new Set());
    }

    // Build an undirected graph.
    for (const link of normalizedGraphData.links) {
      const source =
        typeof link.source === "string"
          ? link.source
          : link.source.id;

      const target =
        typeof link.target === "string"
          ? link.target
          : link.target.id;

      if (!adjacency.has(source)) {
        adjacency.set(source, new Set());
      }

      if (!adjacency.has(target)) {
        adjacency.set(target, new Set());
      }

      adjacency.get(source)!.add(target);
      adjacency.get(target)!.add(source);
    }

    // Safety check.
    if (!adjacency.has(rootId)) {
      console.error(
        `Network root "${rootId}" was not found in normalized network data`
      );

      return {
        nodes: [],
        links: [],
      };
    }

    /**
     * Breadth-first search from Erin.
     */
    const distances =
      new Map<string, number>();

    const queue: string[] = [rootId];

    distances.set(rootId, 0);

    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];

      const currentDepth =
        distances.get(current)!;

      if (currentDepth >= maxDepth) {
        continue;
      }

      for (const neighbor of
        adjacency.get(current) ?? []) {
        if (!distances.has(neighbor)) {
          distances.set(
            neighbor,
            currentDepth + 1
          );

          queue.push(neighbor);
        }
      }
    }

    const visibleNodeIds =
      new Set(distances.keys());

    const nodes =
      normalizedGraphData.nodes.filter(
        (node) =>
          visibleNodeIds.has(node.id)
      );

    /**
     * Decide which edges belong in the ego
     * network, based on each endpoint's
     * distance from the center person.
     *
     * Just being "in range" (distance <=
     * maxDepth) is not enough. Without this,
     * every edge between two visible people
     * gets drawn, including edges that have
     * nothing to do with the center person
     * (e.g. B <-> C when neither is A), which
     * is what made the map feel crowded even
     * at depth 1.
     *
     * Rule:
     * - Always keep an edge that touches the
     *   center person directly (distance 0),
     *   however far the other end is. This is
     *   what surfaces a direct A <-> C link
     *   even when C is also reached through B.
     * - Keep an edge that connects two
     *   adjacent layers (distance difference
     *   of 1), since that is a genuine step
     *   outward in the collaboration chain,
     *   e.g. B -> C or C -> D.
     * - Drop an edge between two people at the
     *   SAME distance from the center (e.g.
     *   B <-> C when both are direct
     *   collaborators of A, but not of each
     *   other through A). Neither person is
     *   the center, so this edge is "sideways"
     *   rather than part of the ego network.
     */
    const links =
      normalizedGraphData.links.filter(
        (link) => {
          const source =
            typeof link.source === "string"
              ? link.source
              : link.source.id;

          const target =
            typeof link.target === "string"
              ? link.target
              : link.target.id;

          const sourceDepth =
            distances.get(source);

          const targetDepth =
            distances.get(target);

          if (
            sourceDepth === undefined ||
            targetDepth === undefined
          ) {
            return false;
          }

          if (
            sourceDepth === 0 ||
            targetDepth === 0
          ) {
            return true;
          }

          return (
            Math.abs(
              sourceDepth - targetDepth
            ) === 1
          );
        }
      );

    return {
      nodes,
      links,
    };
  }, [maxDepth]);

  /**
   * Keep the graph responsive.
   */
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const element = containerRef.current;

    const updateSize = () => {
      setDimensions({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    const observer =
      new ResizeObserver(updateSize);

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  /**
   * Reheat and refit whenever the graph changes.
   */
  useEffect(() => {
    const graph = fgRef.current;

    if (!graph) {
      return;
    }

    graph
      .d3Force("charge")
      ?.strength(-650);

    graph
      .d3Force("link")
      ?.distance(145);

    graph
      .d3Force("center")
      ?.strength(0.45);

    graph.d3ReheatSimulation();

    const timer = window.setTimeout(() => {
      graph.zoomToFit(500, 70);
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [visibleGraph]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl bg-white"
    >
      {dimensions.width > 0 && (
        <ForceGraph2D<
          GraphNode,
          GraphLink
        >
          /*
           * Force a fresh graph instance when
           * the selected depth changes.
           */
          key={`network-depth-${maxDepth}`}

          ref={fgRef}

          width={dimensions.width}
          height={dimensions.height}

          graphData={visibleGraph}

          nodeRelSize={5}

          nodeVal={(node) =>
            node.val ?? 1
          }

          nodeColor={(node) =>
            node.color ?? "#9ca3af"
          }

          nodeLabel={(node) =>
            node.role
              ? `${node.name} — ${node.role}`
              : node.name
          }

          linkColor={() => "#cbd5e1"}

          linkWidth={1.6}

          /**
           * Hover tooltip showing which
           * collaboration(s) this edge
           * represents.
           */
          linkLabel={(link) =>
            getLinkTooltipHtml(
              link as GraphLink
            )
          }

          /**
           * Draw the collaboration title
           * along the edge itself once
           * zoomed in enough to read it.
           */
          linkCanvasObjectMode={() => "after"}

          linkCanvasObject={(
            link,
            ctx,
            globalScale
          ) => {
            if (globalScale < 2.2) {
              return;
            }

            const source =
              link.source as GraphNode;
            const target =
              link.target as GraphNode;

            if (
              typeof source !== "object" ||
              typeof target !== "object" ||
              source.x === undefined ||
              source.y === undefined ||
              target.x === undefined ||
              target.y === undefined
            ) {
              return;
            }

            const label = getLinkTitleLabel(
              link as GraphLink
            );

            if (!label) {
              return;
            }

            const midX =
              (source.x + target.x) / 2;

            const midY =
              (source.y + target.y) / 2;

            const fontSize = Math.max(
              8,
              11 / globalScale
            );

            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Keep long titles from
            // overwhelming the canvas.
            const maxChars = 42;

            const displayLabel =
              label.length > maxChars
                ? `${label.slice(
                    0,
                    maxChars - 1
                  )}…`
                : label;

            const textWidth = ctx.measureText(
              displayLabel
            ).width;

            const padding = 2 / globalScale;

            // Background so the title stays
            // readable over links and nodes.
            ctx.fillStyle =
              "rgba(255, 255, 255, 0.85)";

            ctx.fillRect(
              midX - textWidth / 2 - padding,
              midY - fontSize / 2 - padding,
              textWidth + padding * 2,
              fontSize + padding * 2
            );

            ctx.fillStyle = "#475569";

            ctx.fillText(
              displayLabel,
              midX,
              midY
            );
          }}

          d3VelocityDecay={0.22}
          d3AlphaDecay={0.025}

          cooldownTicks={180}
          warmupTicks={40}

          onNodeClick={(node) => {
            // Find the center person's normalized node
            const centerNode = normalizedGraphData.nodes.find(
              (n) => n.name.trim().toLowerCase() === centerPerson.trim().toLowerCase()
            );

            let sharedWorks: any[] = [];
            
            if (centerNode) {
              // Locate all links directly connecting the center person and the clicked node
              const connectingLinks = normalizedGraphData.links.filter((l) => {
                const sourceId = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
                const targetId = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;

                return (sourceId === centerNode.id && targetId === node.id) ||
                       (sourceId === node.id && targetId === centerNode.id);
              });

              // Flatten the works arrays from all connecting links
              sharedWorks = connectingLinks.flatMap((l) => l.works || []);
            }

            onNodeSelect?.(node, sharedWorks);
          }}

          onEngineStop={() => {
            fgRef.current?.zoomToFit(
              500,
              70
            );
          }}

          /**
           * Only show labels when sufficiently
           * zoomed in.
           */
          nodeCanvasObjectMode={() =>
            "after"
          }

          nodeCanvasObject={(
            node,
            ctx,
            globalScale
          ) => {
            if (globalScale < 1.15) {
              return;
            }

            const label = node.name;

            const fontSize = Math.max(
              10,
              13 / globalScale
            );

            ctx.font = `bold ${fontSize}px Sans-Serif`;

            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            const nodeRadius =
              Math.sqrt(
                Math.max(
                  0,
                  node.val ?? 1
                )
              ) * 5;

            const x = node.x ?? 0;
            const y = node.y ?? 0;

            const yPos =
              y +
              nodeRadius +
              4 / globalScale;

            // White outline.
            ctx.lineWidth =
              3 / globalScale;

            ctx.strokeStyle =
              "rgba(255,255,255,0.9)";

            ctx.strokeText(
              label,
              x,
              yPos
            );

            // Label.
            ctx.fillStyle = "#374151";

            ctx.fillText(
              label,
              x,
              yPos
            );
          }}
        />
      )}

      {/* Network depth controls */}
      <div className="absolute left-6 top-6 z-10 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-md backdrop-blur">
        <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Network Depth
        </div>

        <div className="flex gap-2">
          {[1, 2, 3].map((depth) => (
            <button
              key={depth}
              type="button"
              onClick={() =>
                setMaxDepth(depth)
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${maxDepth === depth
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              {depth}
            </button>
          ))}
        </div>

        <div className="mt-3 text-xs text-gray-400">
          {visibleGraph.nodes.length} people
          {" · "}
          {visibleGraph.links.length}{" "}
          connections
        </div>
      </div>

      {/* Instructions */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-xs text-gray-500 shadow-sm backdrop-blur">
        Click a node for details · Scroll to
        zoom
      </div>
    </div>
  );
}