"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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
  teamMember?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

export type WorkAuthor = {
  id: string;
  name: string;
  orcid: string | null;
  teamMember: boolean;
};

export type WorkOwner = {
  id: string;
  name: string;
  orcid: string;
};

export type Work = {
  putCode: number;
  owner: WorkOwner;
  title: string;
  year: string | null;
  journal: string | null;
  doi: string | null;
  url: string | null;
  authors: WorkAuthor[];
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
  works: Work[];
};

interface MapProps {
  centerPerson: string;
  onNodeSelect?: (node: GraphNode, sharedWorks?: Work[]) => void;
  initialDepth?: number;
}

const graphData = generatedGraphData as GraphData;
console.log(
  "========== COLLABORATION MAP DEBUG =========="
);

console.log(
  "TOTAL NODES:",
  graphData.nodes.length
);

console.log(
  "TOTAL LINKS:",
  graphData.links.length
);

console.log(
  "=============================================="
);

/**
 * Find an existing node only.
 *
 * This function never creates a node and never changes an identity.
 */
function findNode(
  nodes: GraphNode[],
  person: string
): GraphNode | undefined {
  return nodes.find(
    (node) =>
      node.id === person ||
      node.orcid === person ||
      node.name === person
  );
}

/**
 * Get a string ID from a link endpoint.
 *
 * react-force-graph can turn endpoints into GraphNode objects,
 * so we support both forms.
 */
function getEndpointId(
  endpoint: string | GraphNode
): string | undefined {
  if (typeof endpoint === "string") {
    return endpoint;
  }

  return endpoint?.id;
}


export default function CollaborationMap({
  centerPerson,
  onNodeSelect,
  initialDepth = 1,
}: MapProps) {
  console.log("CollaborationMap rendered");
  useEffect(() => {
  console.log("🟢 MAP MOUNTED", centerPerson);

  return () => {
    console.log("🔴 MAP UNMOUNTED", centerPerson);
  };
}, []);
  const graphRef = useRef<any>(null);
  useEffect(() => {
  setTimeout(() => {
    const internalNodes = graphRef.current?.graphData?.().nodes ?? [];

    console.log("INTERNAL NODE COUNT:", internalNodes.length);
  }, 1000);
}, []);

  const [depth, setDepth] = useState(initialDepth);

  /**
   * ------------------------------------------------------------
   * 1. FIND THE ACTIVE PERSON
   * ------------------------------------------------------------
   *
   * We only use nodes to find the person's canonical ID.
   *
   * The actual graph is built entirely from links.
   */
  const activePerson = useMemo(() => {
    return findNode(
      graphData.nodes,
      centerPerson
    );
  }, [centerPerson]);

  /**
   * ------------------------------------------------------------
   * 2. BUILD GRAPH FROM LINKS
   * ------------------------------------------------------------
   *
   * This is the important part.
   *
   * We start with the active person's ID.
   *
   * Then we look ONLY at graphData.links to discover:
   *
   *     active person -> collaborator
   *
   * No names are normalized.
   * No aliases are invented.
   * No nodes are created.
   *
   * The fetcher has already decided who each endpoint represents.
   */
  const visibleGraph = useMemo(() => {
    if (!activePerson) {
      console.warn(
        `[CollaborationMap] Active person "${centerPerson}" was not found in network.json`
      );

      return {
        nodes: [],
        links: [],
      };
    }

    const activeId = activePerson.id;

    /**
     * Build adjacency directly from links.
     */
    const adjacency = new Map<string, Set<string>>();

    for (const link of graphData.links) {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);

      if (!source || !target) {
        continue;
      }

      if (!adjacency.has(source)) {
        adjacency.set(source, new Set());
      }

      if (!adjacency.has(target)) {
        adjacency.set(target, new Set());
      }

      adjacency.get(source)!.add(target);
      adjacency.get(target)!.add(source);
    }

    /**
     * ----------------------------------------------------------
     * BFS FROM ACTIVE PERSON
     * ----------------------------------------------------------
     *
     * Depth 0 = active person
     * Depth 1 = direct collaborators
     * Depth 2 = collaborators of collaborators
     * etc.
     */
    const distances = new Map<string, number>();
    const queue: string[] = [activeId];

    distances.set(activeId, 0);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDepth = distances.get(currentId)!;

      if (currentDepth >= depth) {
        continue;
      }

      const neighbors =
        adjacency.get(currentId) ?? new Set<string>();

      for (const neighborId of neighbors) {
        if (!distances.has(neighborId)) {
          distances.set(
            neighborId,
            currentDepth + 1
          );

          queue.push(neighborId);
        }
      }
    }

    /**
     * These are the ONLY IDs allowed into the graph.
     */
    const visibleIds = new Set(
      distances.keys()
    );
    console.log("DEPTH:", depth);
console.log("ACTIVE PERSON:", activePerson?.name);
console.log("VISIBLE IDS:", visibleIds.size);
console.log(
  "DISTANCES:",
  Array.from(distances.entries()).reduce(
    (acc, [, d]) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  )
);

    /**
     * ----------------------------------------------------------
     * 3. GET NODES FROM network.json
     * ----------------------------------------------------------
     *
     * We do NOT create nodes.
     *
     * We simply look up the IDs discovered through links.
     */
    const nodes = graphData.nodes.filter(
      (node) => visibleIds.has(node.id)
    );

    /**
     * ----------------------------------------------------------
     * 4. GET LINKS FROM network.json
     * ----------------------------------------------------------
     *
     * Again, we don't construct relationships.
     *
     * We simply select the existing links that belong
     * to the visible graph.
     */
    const links = graphData.links.filter(
      (link) => {
        const source = getEndpointId(
          link.source
        );

        const target = getEndpointId(
          link.target
        );

        if (!source || !target) {
          return false;
        }

        return (
          visibleIds.has(source) &&
          visibleIds.has(target)
        );
      }
    );

    return {
      nodes,
      links,
    };
  }, [
    centerPerson,
    activePerson,
    depth,
  ]);

  /**
   * Keep depth synchronized with the parent.
   */
  useEffect(() => {
    setDepth(initialDepth);
  }, [initialDepth]);

  /**
   * Fit graph after changing the active person
   * or depth.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      graphRef.current?.zoomToFit?.(
        500,
        60
      );
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [visibleGraph]);

  /**
   * ------------------------------------------------------------
   * SHARED PUBLICATIONS
   * ------------------------------------------------------------
   *
   * This uses top-level works from network.json.
   *
   * It does not affect graph identity.
   */
  const getSharedWorks = (
    personAId: string,
    personBId: string
  ): Work[] => {
    return graphData.works.filter(
      (work) => {
        const people = new Set<string>();

        /**
         * Owner
         */
        if (work.owner?.id) {
          people.add(work.owner.id);
        }

        if (work.owner?.orcid) {
          people.add(work.owner.orcid);
        }

        /**
         * Authors
         */
        for (const author of work.authors ?? []) {
          if (author.id) {
            people.add(author.id);
          }

          if (author.orcid) {
            people.add(author.orcid);
          }
        }

        return (
          people.has(personAId) &&
          people.has(personBId)
        );
      }
    );
  };

  /**
   * Node click.
   */
  const handleNodeClick = (
    node: GraphNode
  ) => {
    if (!activePerson) {
      return;
    }

    const sharedWorks =
      getSharedWorks(
        activePerson.id,
        node.id
      );

    onNodeSelect?.(
      node,
      sharedWorks
    );
  };

console.log(
  "ALL VISIBLE NODES:",
  visibleGraph.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    orcid: node.orcid,
  }))
);
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* Depth controls */}
      <div className="absolute left-4 top-4 z-10 flex flex-col items-center gap-2 rounded-lg bg-white/90 p-2 shadow">
        
        {/* Row 1 */}
        <div className="text-center text-sm font-semibold uppercase tracking-wide text-gray-500">
          Network Depth
        </div>

        {/* Row 2 */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDepth(value)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                depth === value
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Row 3 */}
        <div className="text-center text-xs text-gray-400">
          {visibleGraph.nodes.length} people
          {" · "}
          {visibleGraph.links.length} connections
        </div>

      </div>      

      <ForceGraph2D
        ref={graphRef}
        graphData={{
  nodes: [...visibleGraph.nodes],
  links: [...visibleGraph.links],
}}

        nodeId="id"

        nodeLabel={(node) => node.name}

        nodeColor={(node: GraphNode) =>
          node.color ??
          (node.teamMember
            ? "#2563eb"
            : "#94a3b8")
        }

        nodeVal={(node: GraphNode) =>
          node.val ?? 4
        }

        linkWidth={(link: GraphLink) =>
          Math.max(1, link.value ?? 1)
        }

        linkLabel={(link: GraphLink) => {
          const works =
            link.works ?? [];

          if (!works.length) {
            return "";
          }

          return works
            .map((work) => {
              const year = work.year
                ? ` (${work.year})`
                : "";

              return `${
                work.title ??
                "Untitled"
              }${year}`;
            })
            .join("\n");
        }}

        onNodeClick={handleNodeClick}

        cooldownTicks={100}

        d3AlphaDecay={0.02}

        d3VelocityDecay={0.3}

        d3Force="charge"

        d3ForceCharge={(force: any) => {
          force.strength(-180);
        }}

        d3ForceLink={(force: any) => {
          force.distance(80);
        }}

        d3ForceCenter={(force: any) => {
          force.strength(0.05);
        }}

        nodeCanvasObject={(
          node: GraphNode,
          ctx: CanvasRenderingContext2D,
          globalScale: number
        ) => {
          const radius =
            Math.sqrt(
              node.val ?? 4
            ) * 2;

          const x = node.x ?? 0;
          const y = node.y ?? 0;

          ctx.beginPath();

          ctx.arc(
            x,
            y,
            radius,
            0,
            2 * Math.PI,
            false
          );

          ctx.fillStyle =
            node.color ??
            (node.teamMember
              ? "#2563eb"
              : "#94a3b8");

          ctx.fill();

          /**
           * Labels only when sufficiently zoomed in.
           */
          if (globalScale >= 0.8) {
            const fontSize =
              12 / globalScale;

            ctx.font = `${fontSize}px Sans-Serif`;

            ctx.textAlign =
              "center";

            ctx.textBaseline =
              "top";

            ctx.fillStyle =
              "#111827";

            ctx.fillText(
              node.name,
              x,
              y + radius + 2
            );
          }
        }}

        linkCanvasObjectMode={() =>
          "after"
        }

        linkCanvasObject={(
          link: GraphLink,
          ctx: CanvasRenderingContext2D,
          globalScale: number
        ) => {
          if (globalScale < 1.2) {
            return;
          }

          /**
           * ForceGraph converts source/target
           * strings into GraphNode objects while
           * rendering.
           */
          const source =
            typeof link.source === "string"
              ? undefined
              : link.source;

          const target =
            typeof link.target === "string"
              ? undefined
              : link.target;

          if (!source || !target) {
            return;
          }

          if (
            source.x == null ||
            source.y == null ||
            target.x == null ||
            target.y == null
          ) {
            return;
          }

          const works =
            link.works ?? [];

          if (!works.length) {
            return;
          }

          
        }}
      />
    </div>
  );
}