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
  onNodeSelect?: (node: GraphNode) => void;
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

          return (
            visibleNodeIds.has(source) &&
            visibleNodeIds.has(target)
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

          d3VelocityDecay={0.22}
          d3AlphaDecay={0.025}

          cooldownTicks={180}
          warmupTicks={40}

          onNodeClick={(node) => {
            onNodeSelect?.(node);
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