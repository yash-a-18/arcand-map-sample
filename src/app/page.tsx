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
  const [activeProfile, setActiveProfile] = useState(TEAM_MEMBERS[0]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-[var(--arcand-primary)] text-white p-5 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide">
            Dr. Gilles Arcand Centre <span className="text-[var(--arcand-accent)]">|</span> Health Equity
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-8 mt-6">
        
        {/* Left Sidebar: Team Directory */}
        <div className="col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Core Team</h3>
          <ul className="space-y-2">
            {TEAM_MEMBERS.map((member) => (
              <li key={member.id}>
                <button 
                  onClick={() => { setActiveProfile(member); setSelectedNode(null); }}
                  className={`w-full text-left px-3 py-2 rounded transition ${
                    activeProfile.id === member.id ? "bg-[var(--arcand-primary)] text-white font-semibold" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {member.id}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Center/Right Content Area */}
        <div className="col-span-1 md:col-span-3 space-y-6">
          
          {/* Active Profile Header */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-6">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex-shrink-0 border-4 border-[var(--arcand-primary)]" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--arcand-primary)]">{selectedNode ? selectedNode.name : activeProfile.id}</h2>
              <p className="text-lg font-medium text-gray-700 mt-1">{selectedNode ? selectedNode.role : activeProfile.title}</p>
              <p className="text-sm text-gray-600 italic border-l-4 border-[var(--arcand-accent)] pl-3 mt-2">
                {selectedNode ? selectedNode.desc : activeProfile.desc}
              </p>
            </div>
          </div>

          {/* Navigation & Map */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <nav className="flex space-x-8 border-b border-gray-200 pb-3 mb-6 text-sm font-bold tracking-wider">
              {["ABOUT", "PUBLICATIONS", "GRANTS", "NETWORK"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 transition ${
                    activeTab === tab ? "text-[var(--arcand-primary)] border-b-4 border-[var(--arcand-accent)]" : "text-gray-400 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <div className="min-h-[500px]">
              {activeTab === "NETWORK" && (
                <div className="h-[600px] border border-gray-200 rounded-xl shadow-sm relative">
                  <CollaborationMap 
                  centerPerson={activeProfile.id}
                  onNodeSelect={setSelectedNode} />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}