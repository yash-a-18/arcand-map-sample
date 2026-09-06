import React from "react";
import networkData from "../data/network.json";

interface WorkAuthor {
  id: string;
  name: string;
  orcid: string | null;
  teamMember: boolean;
}

interface WorkOwner {
  id: string;
  name: string;
  orcid: string;
}

interface Work {
  putCode: number;
  owner: WorkOwner;
  title: string;
  year: string | null;
  journal: string | null;
  doi: string | null;
  url: string | null;
  authors: WorkAuthor[];
}

interface PublicationListProps {
  activeMemberName: string;
}

export default function PublicationList({
  activeMemberName
}: PublicationListProps) {
  // ----------------------------------------------------------
  // Find the active team member
  // ----------------------------------------------------------
  const activeMember = networkData.nodes.find(
    (node: any) =>
      node.id?.toLowerCase() ===
      activeMemberName.toLowerCase()
  );

  // ----------------------------------------------------------
  // Filter ALL works belonging to this member.
  //
  // We now use works[].owner instead of links[].works.
  // This means solo publications are included too.
  // ----------------------------------------------------------
  const memberWorks: Work[] = activeMember
    ? (networkData.works || []).filter(
        (work: Work) =>
          work.owner?.orcid?.toLowerCase() ===
          activeMember.orcid.toLowerCase()
      )
    : [];

  // ----------------------------------------------------------
  // Deduplicate by putCode
  // ----------------------------------------------------------
  const worksMap = new Map<number, Work>();

  memberWorks.forEach((work) => {
    if (!worksMap.has(work.putCode)) {
      worksMap.set(work.putCode, work);
    }
  });

  const uniqueWorks = Array.from(
    worksMap.values()
  );

  // ----------------------------------------------------------
  // Sort newest to oldest
  //
  // Works without a year are placed at the bottom.
  // ----------------------------------------------------------
  uniqueWorks.sort((a, b) => {
    const yearA = a.year
      ? parseInt(a.year, 10)
      : 0;

    const yearB = b.year
      ? parseInt(b.year, 10)
      : 0;

    return yearB - yearA;
  });

  // ----------------------------------------------------------
  // No publications
  // ----------------------------------------------------------
  if (uniqueWorks.length === 0) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500 italic">
        No publications found for {activeMemberName}.
      </div>
    );
  }

  // ----------------------------------------------------------
  // Render publications
  // ----------------------------------------------------------
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-4">
        {uniqueWorks.map((work) => (
          <div
            key={work.putCode}
            className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
          >
            {/* Title */}
            <h4 className="font-semibold text-lg text-gray-900 leading-snug">
              {work.title}
            </h4>

            {/* Journal + Year */}
            <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
              <p>
                <span className="font-medium text-gray-800">
                  Journal:
                </span>{" "}
                {work.journal || "N/A"}
              </p>

              <p>
                <span className="font-medium text-gray-800">
                  Year:
                </span>{" "}
                {work.year || "N/A"}
              </p>
            </div>

            {/* Authors */}
            {work.authors &&
              work.authors.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-800">
                    Authors:
                  </span>{" "}
                  {work.authors
                    .map((author) => author.name)
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}

            {/* DOI */}
            {work.doi && (
              <div className="mt-2 text-sm text-gray-600 break-all">
                <span className="font-medium text-gray-800">
                  DOI:
                </span>{" "}
                {work.doi}
              </div>
            )}

            {/* Publication link */}
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

            {/* DOI fallback link */}
            {!work.url && work.doi && (
              <a
                href={`https://doi.org/${work.doi.replace(
                  /^https?:\/\/doi\.org\//i,
                  ""
                )}`}
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