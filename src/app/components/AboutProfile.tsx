import React from 'react';
import networkData from '../data/network.json';

interface AboutProfileProps {
  activeMemberName: string;
}

export default function AboutProfile({ activeMemberName }: AboutProfileProps) {
  const searchName = activeMemberName.toLowerCase();
  const nodeData = networkData.nodes.find(
    (node: any) => node.name.toLowerCase() === searchName
  );

  if (!nodeData) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500 italic">
        No profile data found for {activeMemberName}.
      </div>
    );
  }

  const { about, employments } = nodeData;

  return (
    <div className="space-y-6 animate-fade-in">
      {about && (
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Biography</h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{about}</p>
        </div>
      )}

      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Employment History</h3>
        {employments && employments.length > 0 ? (
          <ul className="space-y-4">
            {employments.map((emp: any, index: number) => (
              <li key={index} className="border-l-2 border-[var(--arcand-primary)] pl-4">
                <p className="font-semibold text-gray-900">{emp.role || "Role not specified"}</p>
                <p className="text-gray-700">{emp.organization}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {emp.startDate || "Unknown"} to {emp.endDate || "Present"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 italic">No employment history available.</p>
        )}
      </div>
    </div>
  );
}