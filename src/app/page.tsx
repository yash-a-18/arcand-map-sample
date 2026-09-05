"use client";
import { useState } from "react";
import CollaborationMap from "./components/CollaborationMap";

const TEAM_MEMBERS = [
  { id: "Dr. Erin Cameron", title: "Full Professor & Director", desc: "Dr. Gilles Arcand Centre for Health Equity" },
  { id: "Alex Anawati", title: "Team Member", desc: "Arcand Centre Network" },
  { id: "Joseph LeBlanc", title: "Team Member", desc: "Arcand Centre Network" },
  { id: "Brianne Wood", title: "Team Member", desc: "Arcand Centre Network" },
  { id: "Kristy Bourret", title: "Team Member", desc: "Arcand Centre Network" }
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("NETWORK");
  const [selectedNode, setSelectedNode] = useState<any>(null); // Track clicked node

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-[var(--arcand-primary)] text-white p-5 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide">
            Dr. Gilles Arcand Centre <span className="text-[var(--arcand-accent)]">|</span> Health Equity
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-10 mt-6">
        
        {/* Left Sidebar: Dynamic Context Panel */}
        <div className="col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-fit transition-all duration-300">
          {!selectedNode ? (
            <div className="space-y-6 animate-fade-in">
              <div className="w-48 h-48 bg-gray-100 rounded-full mx-auto flex items-center justify-center text-gray-400 border-4 border-[var(--arcand-primary)]">
                [Headshot Placeholder]
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-3xl font-bold text-[var(--arcand-primary)]">Dr. Erin Cameron</h2>
                <p className="text-lg font-medium text-gray-700 mt-2">Full Professor</p>
                <p className="text-sm text-gray-600 mt-1">Northern Ontario School of Medicine University (NOSM U)</p>
                <p className="text-sm text-gray-600 mt-2 italic border-l-4 border-[var(--arcand-accent)] pl-3">
                  Director, Dr. Gilles Arcand Centre for Health Equity
                </p>
              </div>
              <button 
                onClick={() => setActiveTab("NETWORK")}
                className="w-full bg-(--arcand-primary) hover:bg-(--arcand-primary-hover) text-white font-bold py-3 px-4 rounded-lg mt-6 shadow transition duration-200"
              >
                Launch Collaboration Map  
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-sm font-semibold text-gray-500 hover:text-[var(--arcand-primary)] mb-4 flex items-center cursor-pointer"
              >
                ← Back to Primary Profile
              </button>
              <div 
                className="w-24 h-24 rounded-full mx-auto md:mx-0 shadow-inner" 
                style={{ backgroundColor: selectedNode.color || "#ccc" }}
              />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedNode.id}</h2>
                <p className="text-sm font-bold text-[var(--arcand-primary)] uppercase tracking-wide mt-2">{selectedNode.role}</p>
                <p className="text-base text-gray-700 mt-4 leading-relaxed">{selectedNode.desc}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Content Area */}
        <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <nav className="flex space-x-8 border-b border-gray-200 pb-3 mb-6 text-sm font-bold tracking-wider">
            {["ABOUT", "PUBLICATIONS", "GRANTS", "NETWORK"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 transition ${
                  activeTab === tab
                    ? "text-[var(--arcand-primary)] border-b-4 border-[var(--arcand-accent)]"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="min-h-[500px]">
            {activeTab === "NETWORK" && (
              <div className="h-[600px] border border-gray-200 rounded-xl shadow-sm relative">
                <CollaborationMap onNodeSelect={setSelectedNode} />
              </div>
            )}
            
            {/* Placeholder logic for other tabs remains the same... */}
            {activeTab === "ABOUT" && (
              <div className="space-y-8 text-gray-600">
                <p>
                  Dr. Erin Cameron is a Full Professor at the Northern Ontario School of Medicine University (NOSM U) and Director of the Dr. Gilles Arcand Centre for Health Equity. Under her leadership, the Arcand Centre has grown and is now home to 11 research networks advancing social accountability and health equity research. Her academic background includes a PhD in Educational Studies from Lakehead University, an MA in Intercultural and International Communication from Royal Roads University, and a BA from the University of Manitoba.
                </p>
              </div>
            )}
            {(activeTab === "PUBLICATIONS" || activeTab === "GRANTS") && (
              <div className="text-gray-400 italic text-center mt-20">
                Level 1 Capacity data for {activeTab.toLowerCase()} will populate here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}