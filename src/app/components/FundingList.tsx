import React from 'react';
import networkData from '../data/network.json';

interface FundingListProps {
  activeMemberName: string;
}

export default function FundingList({ activeMemberName }: FundingListProps) {
  const searchName = activeMemberName.toLowerCase();
  const nodeData = networkData.nodes.find(
    (node: any) => node.name.toLowerCase() === searchName
  );

  if (!nodeData || !nodeData.fundings || nodeData.fundings.length === 0) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500 italic">
        No grants or funding records found for {activeMemberName}.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {nodeData.fundings.map((grant: any, index: number) => (
        <div key={index} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <h4 className="font-semibold text-lg text-gray-900 leading-snug">{grant.title}</h4>
          <div className="mt-2 text-sm text-gray-600 flex flex-col gap-1">
            <p>
              <span className="font-medium text-gray-800">Organization:</span> {grant.organization || "N/A"}
            </p>
            {(grant.type || grant.year) && (
              <p>
                {grant.type && <span className="mr-4"><span className="font-medium text-gray-800">Type:</span> {grant.type}</span>}
                {grant.year && <span><span className="font-medium text-gray-800">Year:</span> {grant.year}</span>}
              </p>
            )}
            {grant.amount && (
              <p>
                <span className="font-medium text-gray-800">Amount:</span> {grant.amount}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}