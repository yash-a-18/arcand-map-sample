"use client";
import { useState } from "react";
import CollaborationMap from "./components/CollaborationMap";
import PublicationList from "./components/PublicationList";
import AboutProfile from "./components/AboutProfile";
import FundingList from "./components/FundingList";

const TEAM_MEMBERS = [
  { id: "0000-0002-3529-9247", name: "Dr. Erin Cameron", title: "Full Professor & Director", desc: "Dr. Gilles Arcand Centre for Health Equity", src: "/Erin_headshot.jpg" },
  { id: "0000-0001-5767-3781", name: "Alex Anawati", title: "Physician Lead for Policy, Advocacy and Leadership", desc: "Dr. Gilles Arcand Centre for Health Equity", src: "/Alex_headshot.png" },
  { id: "0009-0005-3887-033X", name: "Joseph LeBlanc", title: "Team Member", desc: "Dr. Gilles Arcand Centre for Health Equity", src: "/Joseph_headshot.jpg" },
  { id: "0000-0001-9958-4824", name: "Brianne Wood", title: "Team Member", desc: "Dr. Gilles Arcand Centre for Health Equity", src: "/Brianne_headshot.jpg" },
  { id: "0000-0003-4319-5728", name: "Kirsty Bourret", title: "Research Associate", desc: "Dr. Gilles Arcand Centre for Health Equity", src: "/Kristy_headshot.jpeg" }
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("ABOUT");
  const [activeProfile, setActiveProfile] = useState(TEAM_MEMBERS[0]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [sharedWorks, setSharedWorks] = useState<any[]>([]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-(--arcand-primary) text-white p-5 shadow-md">
        <div className="mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide">
            Dr. Gilles Arcand Centre for Health Equity
          </h1>
        </div>
      </header>

      <div className="mx-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-8 mt-6">

        {/* Left Sidebar: Team Directory */}
        <div className="col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-fit transition-all duration-300">
          <div className="space-y-6 animate-fade-in">
            <div className="w-48 h-48 bg-gray-100 rounded-full mx-auto flex items-center justify-center border-4 border-(--arcand-primary) overflow-hidden">
              <img
                src={activeProfile.src}
                alt={activeProfile.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold text-(--arcand-primary)">{activeProfile.name}</h2>
              <p className="text-lg font-medium text-gray-700 mt-2">{activeProfile.title}</p>
              <p className="text-sm text-gray-600 mt-2 italic border-l-4 border-(--arcand-accent) pl-3">
                Dr. Gilles Arcand Centre for Health Equity
              </p>
            </div>
          </div>
        </div>

        {/* Center/Right Content Area */}
        <div className="col-span-1 md:col-span-2 space-y-6">

          {/* Navigation & Map */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <nav className="flex space-x-8 border-b border-gray-200 pb-3 mb-6 text-sm font-bold tracking-wider">
              {["ABOUT", "PUBLICATIONS", "GRANTS", "NETWORK"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 transition ${activeTab === tab ? "text-(--arcand-primary) border-b-4 border-(--arcand-accent)" : "text-gray-400 hover:text-gray-700"
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
                    centerPerson={activeProfile.name}
                    onNodeSelect={(node, works) => {
                      setSelectedNode(node);
                      setSharedWorks(works || []);
                    }} />
                </div>
              )}

              {activeTab === "PUBLICATIONS" && (
                <PublicationList activeMemberName={activeProfile.id} />
              )}

              {activeTab === "ABOUT" && (
                <AboutProfile activeMemberName={activeProfile.name} />
              )}

              {activeTab === "GRANTS" && (
                <FundingList activeMemberName={activeProfile.name} />
              )}
            </div>

          </div>
        </div>

        {/* Right Active Profile with Collab Info */}
        <div className="col-span-1 md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col space-y-4 transition-all">
            <div>
              <h2 className="text-3xl font-bold text-(--arcand-primary)">
                {selectedNode ? selectedNode.name : activeProfile.name}
              </h2>
              <p className="text-lg font-medium text-gray-700 mt-1">
                {selectedNode ? selectedNode.role : activeProfile.title}
              </p>
              <p className="text-sm text-gray-600 italic border-l-4 border-(--arcand-accent) pl-3 mt-2">
                {selectedNode ? selectedNode.desc : activeProfile.desc}
              </p>
            </div>

            {/* List of Collaborations */}
            {selectedNode && (
              <div className="pt-4 border-t border-gray-200 animate-fade-in">
                <h3 className="text-sm font-bold tracking-wider text-gray-900 uppercase mb-3">
                  Shared Works
                </h3>

                {sharedWorks.length > 0 ? (
                  <ul className="space-y-3">
                    {sharedWorks.map((work, idx) => (
                      <li key={idx} className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="font-semibold block text-gray-900">{work.title}</span>
                        {(work.journal || work.year) && (
                          <span className="text-gray-500 text-xs block mt-1">
                            {work.journal} {work.year ? `(${work.year})` : ""}
                          </span>
                        )}
                        {work.url && (
                          <a
                            href={work.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-(--arcand-primary) hover:text-(--arcand-accent) font-medium text-xs block mt-2 transition-colors"
                          >
                            View Publication &rarr;
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No direct shared works found with {activeProfile.name}.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}