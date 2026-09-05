"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Define the prop type so Next.js can pass data up to the main page
interface MapProps {
  onNodeSelect?: (node: any) => void;
}

export default function CollaborationMap({ onNodeSelect }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null); 
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    }
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge").strength(-1000);
      fgRef.current.d3Force("link").distance(180);
      fgRef.current.d3ReheatSimulation();
    }
  }, [dimensions]);

  const graphData = {
    nodes: [
      { id: "Dr. Erin Cameron", role: "Focal Node", group: 1, val: 20, color: "var(--arcand-primary)", desc: "Full Professor & Director of the Arcand Centre." },
      { id: "Arcand Centre", role: "Institution", group: 2, val: 12, color: "var(--arcand-accent)", desc: "Home to 11 research networks advancing social accountability." },
      { id: "MERLIN Lab", role: "Research Lab", group: 2, val: 10, color: "#2E8B57", desc: "Medical Education Research Lab in the North, founded in 2018." },
      { id: "CREATE Project", role: "Grant", group: 3, val: 10, color: "#D2691E", desc: "7-year SSHRC-funded partnership studying networked research." },
      { id: "CityStudio", role: "Community Partnership", group: 3, val: 10, color: "#4682B4", desc: "Municipal civic challenge collaboration model." },
      { id: "Brenton Button", role: "Postdoctoral Fellow", group: 4, val: 6, color: "#696969", desc: "Primary supervision under Dr. Cameron." },
      { id: "Sophie Myles", role: "Postdoctoral Fellow", group: 4, val: 6, color: "#696969", desc: "Primary supervision under Dr. Cameron." },
      { id: "C. Larche", role: "Co-Author", group: 5, val: 5, color: "#800080", desc: "Co-authored publications on medical education accreditation." },
      { id: "A. Anawati", role: "Co-Author", group: 5, val: 5, color: "#800080", desc: "Co-authored publications on environmental accountability." }
    ],
    links: [
      { source: "Dr. Erin Cameron", target: "Arcand Centre" },
      { source: "Dr. Erin Cameron", target: "MERLIN Lab" },
      { source: "Dr. Erin Cameron", target: "CREATE Project" },
      { source: "Dr. Erin Cameron", target: "CityStudio" },
      { source: "MERLIN Lab", target: "Brenton Button" },
      { source: "Arcand Centre", target: "Sophie Myles" },
      { source: "Dr. Erin Cameron", target: "C. Larche" },
      { source: "Dr. Erin Cameron", target: "A. Anawati" },
      { source: "A. Anawati", target: "Sophie Myles" }
    ]
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-white rounded-lg shadow-inner overflow-hidden flex items-center justify-center cursor-move">
      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeRelSize={5}
          nodeColor={(node: any) => node.color}
          linkColor={() => "#cbd5e1"} 
          linkWidth={2.5} 
          d3VelocityDecay={0.1}
          onNodeClick={onNodeSelect} // Trigger the state change on click
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
            const label = node.id;
            const fontSize = 13 / globalScale;
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const nodeRadius = Math.sqrt(Math.max(0, node.val || 1)) * 5; 
            const yPos = node.y + nodeRadius + (4 / globalScale);

            ctx.lineWidth = 3 / globalScale;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.strokeText(label, node.x, yPos);

            ctx.fillStyle = '#374151'; 
            ctx.fillText(label, node.x, yPos);
          }}
        />
      )}
    </div>
  );
}