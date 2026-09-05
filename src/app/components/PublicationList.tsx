import React from 'react';
import networkData from "../data/network.json"; // Adjust the path to your JSON file

interface Work {
  putCode: number;
  title: string;
  year: string;
  journal: string;
  doi: string;
  url: string;
}

interface PublicationListProps {
  activeMemberName: string;
}

export default function PublicationList({ activeMemberName }: PublicationListProps) {
  // Convert to lowercase to match the formatting in your network.json links
  const searchName = activeMemberName.toLowerCase();

  // Filter links where the active member is either the source or the target
  const memberLinks = networkData.links.filter((link: any) => {
    const sourceName = typeof link.source === 'string' ? link.source : link.source.id;
    const targetName = typeof link.target === 'string' ? link.target : link.target.id;
    
    return (
      (sourceName && sourceName.toLowerCase() === searchName) || 
      (targetName && targetName.toLowerCase() === searchName)
    );
  });

  // Extract and deduplicate works using putCode
  const worksMap = new Map<number, Work>();
  memberLinks.forEach((link: any) => {
    if (link.works && Array.isArray(link.works)) {
      link.works.forEach((work: Work) => {
        if (!worksMap.has(work.putCode)) {
          worksMap.set(work.putCode, work);
        }
      });
    }
  });

  const uniqueWorks = Array.from(worksMap.values());
  
  // Sort publications from newest to oldest
  uniqueWorks.sort((a, b) => parseInt(b.year) - parseInt(a.year));

  if (uniqueWorks.length === 0) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500 italic">
        No publications found in the network data for {activeMemberName}.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-4">
        {uniqueWorks.map((work) => (
          <div key={work.putCode} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <h4 className="font-semibold text-lg text-gray-900 leading-snug">{work.title}</h4>
            <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
              <p>
                <span className="font-medium text-gray-800">Journal:</span> {work.journal || "N/A"}
              </p>
              <p>
                <span className="font-medium text-gray-800">Year:</span> {work.year || "N/A"}
              </p>
            </div>
            {work.url && (
              <a
                href={work.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-sm font-medium text-[var(--arcand-primary)] hover:text-[var(--arcand-accent)] transition-colors"
              >
                View Publication &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}