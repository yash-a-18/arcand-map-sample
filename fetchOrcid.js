const fs = require("fs");
const https = require("https");

const TEAM = [
  {
    name: "Dr. Erin Cameron",
    orcid: "0000-0002-3529-9247",
    role: "Director"
  },
  {
    name: "Alex Anawati",
    orcid: "0000-0001-5767-3781",
    role: "Team Member"
  },
  {
    name: "Joseph LeBlanc",
    orcid: "0009-0005-3887-033X",
    role: "Team Member"
  },
  {
    name: "Brianne Wood",
    orcid: "0000-0001-9958-4824",
    role: "Team Member"
  },
  {
    name: "Kirsty Bourret",
    orcid: "0000-0003-4319-5728",
    role: "Team Member"
  }
];

const OUTPUT_FILE =
  "./src/app/data/network.json";

// ============================================================
// HTTP helper
// ============================================================

function httpsGet(
  hostname,
  path
) {
  return new Promise(
    (resolve, reject) => {
      const options = {
        hostname,
        path,
        method: "GET",
        headers: {
          Accept:
            "application/json"
        }
      };

      const req = https.request(
        options,
        (res) => {
          let data = "";

          res.on(
            "data",
            (chunk) => {
              data += chunk;
            }
          );

          res.on(
            "end",
            () => {
              if (
                res.statusCode <
                  200 ||
                res.statusCode >=
                  300
              ) {
                reject(
                  new Error(
                    `HTTP ${res.statusCode}: ${data.substring(
                      0,
                      500
                    )}`
                  )
                );

                return;
              }

              try {
                resolve(
                  JSON.parse(data)
                );
              } catch (error) {
                reject(
                  new Error(
                    `Invalid JSON response: ${error.message}`
                  )
                );
              }
            }
          );
        }
      );

      req.on(
        "error",
        reject
      );

      req.end();
    }
  );
}

// ============================================================
// ORCID Fetchers
// ============================================================

async function fetchWorks(
  orcid
) {
  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/works`
  );
}

async function fetchWorkDetails(
  orcid,
  putCode
) {
  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/work/${putCode}`
  );
}

async function fetchPerson(
  orcid
) {
  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/person`
  );
}

async function fetchEmployments(
  orcid
) {
  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/employments`
  );
}

async function fetchFundings(
  orcid
) {
  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/fundings`
  );
}

// ============================================================
// Name normalization
// ============================================================

/**
 * Basic normalization.
 *
 * Examples:
 *
 * "Dr. Kirsty Bourret"
 *   -> "kirsty bourret"
 *
 * "Kirsty   M. Bourret"
 *   -> "kirsty m. bourret"
 */
function normalizeName(
  name
) {
  if (!name) {
    return null;
  }

  return name
    .replace(/\u00A0/g, " ")
    .replace(
      /^dr\.?\s+/i,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .toLowerCase();
}

/**
 * Remove middle initials.
 *
 * Examples:
 *
 * "kirsty m. bourret"
 *   -> "kirsty bourret"
 *
 * "joseph a leblanc"
 *   -> "joseph leblanc"
 */
function normalizeNameWithoutMiddleInitials(
  name
) {
  const normalized =
    normalizeName(name);

  if (!normalized) {
    return null;
  }

  const parts =
    normalized.split(" ");

  if (
    parts.length <= 2
  ) {
    return normalized;
  }

  const first =
    parts[0];

  const last =
    parts[
      parts.length - 1
    ];

  const middle =
    parts.slice(
      1,
      -1
    );

  const filteredMiddle =
    middle.filter(
      (part) =>
        !/^[a-z]\.?$/.test(
          part
        )
    );

  return [
    first,
    ...filteredMiddle,
    last
  ].join(" ");
}

/**
 * Get first/last name components.
 */
function getNameParts(
  name
) {
  if (!name) {
    return {
      first: "",
      last: ""
    };
  }

  const normalized =
    normalizeName(
      name
    );

  if (!normalized) {
    return {
      first: "",
      last: ""
    };
  }

  // ----------------------------------------------------------
  // Handle "Last, First" formats
  //
  // Examples:
  // "Cameron, E."
  // "Cameron, E.M."
  // "Cameron, Erin"
  // ----------------------------------------------------------

  if (normalized.includes(",")) {
    const [lastPart, firstPart] =
      normalized
        .split(",")
        .map(
          (part) =>
            part.trim()
        );

    return {
      first:
        firstPart
          ?.split(" ")[0]
          ?.replace(/\./g, "") ||
        "",
      last:
        lastPart
          ?.replace(/\./g, "")
          .trim() ||
        ""
    };
  }

  // ----------------------------------------------------------
  // Standard "First Middle Last" format
  // ----------------------------------------------------------

  const withoutMiddle =
    normalizeNameWithoutMiddleInitials(
      normalized
    );

  if (!withoutMiddle) {
    return {
      first: "",
      last: ""
    };
  }

  const parts =
    withoutMiddle.split(" ");

  return {
    first:
      parts[0] || "",
    last:
      parts[
        parts.length - 1
      ] || ""
  };
}
console.log("NAME TESTS:");

console.log(
  "Cameron, E.M. →",
  getNameParts("Cameron, E.M.")
);

console.log(
  "Cameron, E. →",
  getNameParts("Cameron, E.")
);

console.log(
  "Erin Cameron →",
  getNameParts("Erin Cameron")
);

console.log(
  "Erin C. Cameron →",
  getNameParts("Erin C. Cameron")
);

// ============================================================
// Small Levenshtein implementation
// ============================================================

/**
 * Used only for resolving a contributor against the
 * small, known CORE TEAM list.
 *
 * This lets:
 *
 * "kirsty bourret"
 *
 * resolve to:
 *
 * "Kirsty Bourret"
 *
 * when the surname matches and the first name differs
 * by only one character.
 */
console.log("🚨 LEVENSHTEIN FUNCTION FILE LOADED");
function levenshtein(
  a,
  b
) {
  const matrix =
    Array.from(
      {
        length:
          b.length + 1
      },
      () =>
        Array(
          a.length + 1
        ).fill(0)
    );

  for (
    let i = 0;
    i <= a.length;
    i++
  ) {
    matrix[0][i] = i;
  }

  for (
    let j = 0;
    j <= b.length;
    j++
  ) {
    matrix[j][0] = j;
  }

  for (
    let j = 1;
    j <= b.length;
    j++
  ) {
    for (
      let i = 1;
      i <= a.length;
      i++
    ) {
      if (
        a[i - 1] ===
        b[j - 1]
      ) {
        matrix[j][i] =
          matrix[j - 1][
            i - 1
          ];
      } else {
        matrix[j][i] =
          Math.min(
            matrix[j - 1][i] +
              1,
            matrix[j][i - 1] +
              1,
            matrix[j - 1][
              i - 1
            ] +
              1
          );
      }
    }
  }

  return matrix[b.length][
    a.length
  ];
}

// ============================================================
// Core team lookup
// ============================================================

const TEAM_BY_NAME =
  new Map();

const TEAM_BY_NAME_NO_MIDDLE =
  new Map();

for (const member of TEAM) {
  const normalized =
    normalizeName(
      member.name
    );

  const withoutMiddle =
    normalizeNameWithoutMiddleInitials(
      member.name
    );

  TEAM_BY_NAME.set(
    normalized,
    member
  );

  TEAM_BY_NAME_NO_MIDDLE.set(
    withoutMiddle,
    member
  );
}
console.log("TEAM MATCH TESTS:");

for (const member of TEAM) {
  const parts = getNameParts(member.name);

  const first = parts.first;
  const last = parts.last;
  const initial = first.charAt(0).toUpperCase();

  const tests = [
    member.name,
    `${first} ${last}`,
    `${initial}. ${last}`,
    `${initial} ${last}`,
    `${first} C. ${last}`,
    `${first} C ${last}`,
    `${initial}. C. ${last}`,
    `${initial} C ${last}`,
    `${last}, ${initial}.`,
    `${last} ${initial}`,
    `${last} ${initial}.`
  ];

  console.log(`\n--- ${member.name} ---`);

  for (const name of tests) {
    const match = findTeamMemberByName(name);

    console.log(
      `${name} →`,
      match ? match.name : "NO MATCH"
    );
  }
}

// ============================================================
// Find core team member from a contributor
// ============================================================

function findTeamMemberByName(
  name
) {
  if (!name) {
    return null;
  }

  // ----------------------------------------------------------
  // 1. Exact normalized match
  // ----------------------------------------------------------

  const normalized =
    normalizeName(name);

  const exact =
    TEAM_BY_NAME.get(
      normalized
    );

  if (exact) {
    return exact;
  }

  // ----------------------------------------------------------
  // 2. Ignore middle initials
  // ----------------------------------------------------------

  const withoutMiddle =
    normalizeNameWithoutMiddleInitials(
      name
    );

  const noMiddle =
    TEAM_BY_NAME_NO_MIDDLE.get(
      withoutMiddle
    );

  if (noMiddle) {
    return noMiddle;
  }

  // ----------------------------------------------------------
  // 3. Get first/last name
  // ----------------------------------------------------------

  const contributorParts =
    getNameParts(name);

  if (
    !contributorParts.first ||
    !contributorParts.last
  ) {
    return null;
  }

  const contributorFirst =
    contributorParts.first;

  const contributorLast =
    contributorParts.last;
    // ----------------------------------------------------------
  // 4. Handle abbreviated "Last Initial" formats
  //
  // Examples:
  // "Cameron E"
  // "Cameron E."
  // "Cameron EM"
  // "Cameron E.M."
  //
  // These are different from normal "First Last" names.
  // ----------------------------------------------------------

  const nameParts =
    normalized
      .replace(/\./g, "")
      .split(/\s+/);

  if (
    nameParts.length === 2 &&
    /^[a-z]+$/i.test(nameParts[0]) &&
    /^[a-z]+$/i.test(nameParts[1]) &&
    nameParts[1].length <= 3
  ) {
    const possibleLast =
      nameParts[0];

    const initials =
      nameParts[1];

    const initialMatches =
      TEAM.filter(
        (member) => {
          const memberParts =
            getNameParts(
              member.name
            );

          return (
            memberParts.last ===
              possibleLast &&
            memberParts.first.charAt(0) ===
              initials.charAt(0)
          );
        }
      );

    if (
      initialMatches.length === 1
    ) {
      console.log(
        `    ↳ Matched abbreviated team name "${name}" → "${initialMatches[0].name}"`
      );

      return initialMatches[0];
    }

    if (
      initialMatches.length > 1
    ) {
      console.log(
        `    ⚠️ Ambiguous abbreviated author "${name}" — not matched`
      );

      return null;
    }
  }

  // ----------------------------------------------------------
  // 4. Initial-based matching
  //
  // Handles:
  //
  // "E. Cameron"
  // "E Cameron"
  // "Cameron, E."
  // "Cameron, E.M."
  //
  // Only accepts the match when exactly ONE team member
  // has the same surname and compatible initials.
  // ----------------------------------------------------------

  const contributorInitials =
    contributorFirst
      .replace(/[^a-z]/g, "");

  const isInitialFormat =
    contributorInitials.length <= 2 &&
    contributorInitials.length > 0;

  if (isInitialFormat) {
    const initialMatches =
      TEAM.filter(
        (member) => {
          const memberParts =
            getNameParts(
              member.name
            );

          if (
            memberParts.last !==
            contributorLast
          ) {
            return false;
          }

          const memberFirstInitial =
            memberParts.first.charAt(0);

          return (
            contributorInitials.charAt(0) ===
            memberFirstInitial
          );
        }
      );

    if (
      initialMatches.length === 1
    ) {
      console.log(
        `    ↳ Matched team member initials "${name}" → "${initialMatches[0].name}"`
      );

      return initialMatches[0];
    }

    if (
      initialMatches.length > 1
    ) {
      console.log(
        `    ⚠️ Ambiguous author initials "${name}" — not matched`
      );

      return null;
    }
  }

  // ----------------------------------------------------------
  // 5. First/last matching with small spelling tolerance
  //
  // Example:
  // "Kirsty Bourret"
  // "Kristy Bourret"
  // ----------------------------------------------------------

  const possibleMatches = [];

  for (const member of TEAM) {
    const memberParts =
      getNameParts(
        member.name
      );

    if (
      contributorLast !==
      memberParts.last
    ) {
      continue;
    }

    const firstDistance =
      levenshtein(
        contributorFirst,
        memberParts.first
      );

    const maxDistance = 2;

    if (
      firstDistance <=
      maxDistance
    ) {
      possibleMatches.push({
        member,
        firstDistance
      });
    }
  }

  // ----------------------------------------------------------
  // 6. Only accept a spelling match when unique
  // ----------------------------------------------------------

  if (
    possibleMatches.length === 1
  ) {
    console.log(
      `    ↳ Matched team member spelling "${name}" → "${possibleMatches[0].member.name}"`
    );

    return possibleMatches[0].member;
  }

  return null;
}


// ============================================================
// Extract ORCID from contributor
// ============================================================

function getContributorOrcid(
  contributor
) {
  const contributorOrcid =
    contributor[
      "contributor-orcid"
    ];

  if (
    !contributorOrcid
  ) {
    return null;
  }

  let value =
    contributorOrcid.uri ||
    contributorOrcid.path ||
    null;

  if (!value) {
    return null;
  }

  return value
    .replace(
      "https://orcid.org/",
      ""
    )
    .replace(
      "http://orcid.org/",
      ""
    )
    .trim()
    .toLowerCase();
}

// ============================================================
// Identify contributor
// ============================================================

/**
 * IMPORTANT:
 *
 * Core team members ALWAYS get:
 *
 *   id = canonical ORCID
 *
 * regardless of how ORCID spells their name.
 *
 * External collaborators get:
 *
 *   id = ORCID when available
 *   otherwise normalized name
 */
function identifyContributor(
  contributor
) {
  const name =
    contributor[
      "credit-name"
    ]?.value ||
    contributor[
      "contributor-name"
    ]?.value ||
    null;

  const orcid =
    getContributorOrcid(
      contributor
    );

  // ----------------------------------------------------------
  // 1. ORCID is authoritative
  // ----------------------------------------------------------

  if (orcid) {
    const teamMember =
      TEAM.find(
        (member) =>
          member.orcid
            .toLowerCase() ===
          orcid
      );

    if (teamMember) {
      return {
        id: teamMember.orcid,
        name: teamMember.name,
        orcid:
          teamMember.orcid,
        teamMember: true
      };
    }
  }

  // ----------------------------------------------------------
  // 2. Try robust core-team name matching
  // ----------------------------------------------------------
  

  if (name) {
    console.log(
  "🔎 TEAM NAME MATCH:",
  name,
  "→",
  normalizeName(name),
  "→",
  normalizeNameWithoutMiddleInitials(name)
);
    const teamMember =
      findTeamMemberByName(
        name
      );

    if (teamMember) {
      return {
        id: teamMember.orcid,
        name: teamMember.name,
        orcid:
          teamMember.orcid,
        teamMember: true
      };
    }
  }

  // ----------------------------------------------------------
  // 3. External contributor
  // ----------------------------------------------------------

  return {
    id:
      orcid ||
      normalizeName(name),
    name:
      name,
    orcid:
      orcid,
    teamMember: false
  };
}

// ============================================================
// Add collaboration
// ============================================================

function addCollaboration(
  collaborationMap,
  personA,
  personB,
  work
) {
  if (
    !personA ||
    !personB ||
    !personA.id ||
    !personB.id ||
    personA.id ===
      personB.id
  ) {
    return;
  }

  // ----------------------------------------------------------
  // Canonical stable ordering
  // ----------------------------------------------------------

  const [
    source,
    target
  ] =
    personA.id <
    personB.id
      ? [
          personA.id,
          personB.id
        ]
      : [
          personB.id,
          personA.id
        ];

  const key =
    `${source}|${target}`;

  if (
    !collaborationMap.has(
      key
    )
  ) {
    collaborationMap.set(
      key,
      {
        source,
        target,
        value: 0,
        works: []
      }
    );
  }

  const link =
    collaborationMap.get(
      key
    );

  const alreadyAdded =
    link.works.some(
      (existing) =>
        existing.putCode ===
        work.putCode
    );

  if (alreadyAdded) {
    return;
  }

  link.value += 1;

  link.works.push({
    putCode:
      work.putCode,
    title:
      work.title,
    year:
      work.year,
    journal:
      work.journal,
    doi:
      work.doi,
    url:
      work.url
  });
}

// ============================================================
// Main graph builder
// ============================================================

async function buildUnifiedGraph() {
  const nodes =
    new Map();

  const collaborationMap =
    new Map();

  const worksMap =
    new Map();

  // ==========================================================
  // Initialize CORE TEAM nodes
  // ==========================================================

  for (const member of TEAM) {
    nodes.set(
      member.orcid,
      {
        id:
          member.orcid,
        name:
          member.name,
        role:
          member.role,
        group: 1,
        val: 25,
        color:
          "var(--arcand-primary)",
        desc:
          `Core Arcand Centre Team Member (ORCID: ${member.orcid})`,
        orcid:
          member.orcid,
        about: null,
        employments: [],
        fundings: []
      }
    );
  }

  // ==========================================================
  // Process every team member
  // ==========================================================

  for (const member of TEAM) {
    console.log(
      `\nProcessing data for ${member.name}...`
    );

    const nodeRef =
      nodes.get(
        member.orcid
      );

    // ========================================================
    // 1. Biography
    // ========================================================

    try {
      const personData =
        await fetchPerson(
          member.orcid
        );

      nodeRef.about =
        personData
          ?.biography
          ?.content ||
        null;
    } catch (error) {
      console.error(
        `  ✗ Failed to fetch biography for ${member.name}:`,
        error.message
      );
    }

    // ========================================================
    // 2. Employments
    // ========================================================

    try {
      const empData =
        await fetchEmployments(
          member.orcid
        );

      const empGroups =
        empData[
          "affiliation-group"
        ] || [];

      for (const group of empGroups) {
        const summaries =
          group.summaries ||
          [];

        for (const item of summaries) {
          const summary =
            item[
              "employment-summary"
            ];

          if (!summary) {
            continue;
          }

          nodeRef.employments.push({
            role:
              summary[
                "role-title"
              ] || null,

            organization:
              summary
                .organization
                ?.name ||
              null,

            startDate:
              summary[
                "start-date"
              ]?.year?.value ||
              null,

            endDate:
              summary[
                "end-date"
              ]?.year?.value ||
              "Present"
          });
        }
      }
    } catch (error) {
      console.error(
        `  ✗ Failed to fetch employments for ${member.name}:`,
        error.message
      );
    }

    // ========================================================
    // 3. Funding
    // ========================================================

    try {
      const fundData =
        await fetchFundings(
          member.orcid
        );

      const fundGroups =
        fundData.group || [];

      for (const group of fundGroups) {
        const summaries =
          group[
            "funding-summary"
          ] || [];

        for (const summary of summaries) {
          nodeRef.fundings.push({
            title:
              summary.title
                ?.title
                ?.value ||
              "Untitled Funding",

            type:
              summary.type ||
              null,

            organization:
              summary
                .organization
                ?.name ||
              null,

            year:
              summary[
                "start-date"
              ]?.year?.value ||
              null,

            amount:
              summary.amount
                ? `${summary.amount.value} ${summary.amount["currency-code"]}`
                : null
          });
        }
      }
    } catch (error) {
      console.error(
        `  ✗ Failed to fetch fundings for ${member.name}:`,
        error.message
      );
    }

    // ========================================================
    // 4. Works & Collaborations
    // ========================================================

    try {
      const data =
        await fetchWorks(
          member.orcid
        );

      const works =
        data.group || [];

      console.log(
        `  ${member.name}: ${works.length} works found`
      );

      let savedWorks = 0;
      let collaborationPairs = 0;

      for (const workGroup of works) {
        // ----------------------------------------------------
        // Work summary
        // ----------------------------------------------------

        const summary =
          workGroup[
            "work-summary"
          ]?.[0];

        if (!summary) {
          console.log(
            "  ⚠ Skipping work group with no summary"
          );

          continue;
        }

        const putCode =
          summary[
            "put-code"
          ];

        if (
          putCode ===
          undefined ||
          putCode ===
          null
        ) {
          console.log(
            "  ⚠ Skipping work with no put-code"
          );

          continue;
        }

        // ----------------------------------------------------
        // Full work details
        // ----------------------------------------------------

        let details;

        try {
          details =
            await fetchWorkDetails(
              member.orcid,
              putCode
            );
        } catch (error) {
          console.error(
            `  ✗ Failed to fetch work ${putCode}:`,
            error.message
          );

          continue;
        }

        // ----------------------------------------------------
        // Metadata
        // ----------------------------------------------------

        const title =
          details.title
            ?.title
            ?.value ||
          summary.title
            ?.title
            ?.value ||
          "Untitled";

        const year =
          details[
            "publication-date"
          ]?.year?.value ||
          null;

        const journal =
          details[
            "journal-title"
          ]?.value ||
          null;

        const url =
          details.url?.value ||
          null;

        let doi = null;

        const externalIds =
          details[
            "external-ids"
          ]?.[
            "external-id"
          ] || [];

        const doiEntry =
          externalIds.find(
            (id) =>
              id[
                "external-id-type"
              ]
                ?.toLowerCase() ===
              "doi"
          );

        if (doiEntry) {
          doi =
            doiEntry[
              "external-id-value"
            ] ||
            doiEntry[
              "external-id-normalized"
            ]?.value ||
            null;
        }

        // ----------------------------------------------------
        // Work object
        // ----------------------------------------------------

        const work = {
          putCode,
          owner: {
            id:
              member.orcid,
            name:
              member.name,
            orcid:
              member.orcid
          },
          title,
          year,
          journal,
          doi,
          url,
          authors: []
        };

        // ----------------------------------------------------
        // IMPORTANT:
        //
        // The ORCID whose works we are currently fetching is
        // ALWAYS a participant in that work.
        //
        // This prevents a missing owner from causing the
        // entire collaboration network to disappear.
        // ----------------------------------------------------

        const ownerPerson = {
          id:
            member.orcid,
          name:
            member.name,
          orcid:
            member.orcid,
          teamMember: true
        };

        const people = [
          ownerPerson
        ];

        // Add owner to authors exactly once.
        work.authors.push({
          id:
            ownerPerson.id,
          name:
            ownerPerson.name,
          orcid:
            ownerPerson.orcid,
          teamMember: true
        });

        // ----------------------------------------------------
        // Contributors
        // ----------------------------------------------------

        const contributors =
          details
            .contributors
            ?.contributor ||
          [];

        console.log(
          `  Work ${putCode}: "${title}"`
        );

        console.log(
          `    Contributors from ORCID: ${contributors.length}`
        );

        for (const contributor of contributors) {
          const person =
            identifyContributor(
              contributor
            );

          if (
            !person.id ||
            !person.name
          ) {
            console.log(
              "    ⚠ Skipped contributor with missing ID/name"
            );

            continue;
          }

          // --------------------------------------------------
          // Do not add the owner twice.
          // --------------------------------------------------

          const alreadyInPeople =
            people.some(
              (existing) =>
                existing.id ===
                person.id
            );

          if (
            alreadyInPeople
          ) {
            continue;
          }

          // --------------------------------------------------
          // External collaborator node
          // --------------------------------------------------

          if (
            !person.teamMember &&
            !nodes.has(
              person.id
            )
          ) {
            nodes.set(
              person.id,
              {
                id:
                  person.id,
                name:
                  person.name,
                role:
                  "Co-Author",
                group: 5,
                val: 5,
                color:
                  "#800080",
                desc:
                  "External Collaborator",
                orcid:
                  person.orcid
              }
            );
          }

          // --------------------------------------------------
          // Add person to work participants.
          // --------------------------------------------------

          people.push(
            person
          );

          work.authors.push({
            id:
              person.id,
            name:
              person.name,
            orcid:
              person.orcid,
            teamMember:
              person.teamMember
          });
        }

        console.log(
          `    Canonical participants: ${people.length}`
        );

        // ----------------------------------------------------
        // Print useful debugging information.
        // ----------------------------------------------------

        console.log(
          `    Owner: ${ownerPerson.name} → ${ownerPerson.id}`
        );

        for (const person of people) {
          console.log(
            `    Author: ${person.name} → ${person.id}${
              person.teamMember
                ? " [CORE]"
                : " [EXTERNAL]"
            }`
          );
        }

        // ----------------------------------------------------
        // Save EVERY work.
        // ----------------------------------------------------

        worksMap.set(
          putCode,
          work
        );

        savedWorks++;

        // ----------------------------------------------------
        // Build EVERY pairwise collaboration.
        // ----------------------------------------------------

        for (
          let i = 0;
          i < people.length;
          i++
        ) {
          for (
            let j = i + 1;
            j < people.length;
            j++
          ) {
            addCollaboration(
              collaborationMap,
              people[i],
              people[j],
              work
            );

            collaborationPairs++;
          }
        }
      }

      console.log(
        `  ✓ Finished processing ${member.name}`
      );

      console.log(
        `    Works saved: ${savedWorks}`
      );

      console.log(
        `    Collaboration pairs generated: ${collaborationPairs}`
      );
    } catch (error) {
      console.error(
        `  ✗ Failed to fetch works for ${member.name}:`,
        error.message
      );
    }
  }

  // ==========================================================
  // Final arrays
  // ==========================================================

  const links =
    Array.from(
      collaborationMap.values()
    );

  const allWorks =
    Array.from(
      worksMap.values()
    );

  // ==========================================================
  // Ensure directory exists
  // ==========================================================

  if (
    !fs.existsSync(
      "./src/app/data"
    )
  ) {
    fs.mkdirSync(
      "./src/app/data",
      {
        recursive: true
      }
    );
  }

  // ==========================================================
  // Final output
  // ==========================================================

  const output = {
    nodes:
      Array.from(
        nodes.values()
      ),
    links,
    works:
      allWorks
  };

  // ==========================================================
  // Write network.json
  // ==========================================================

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      output,
      null,
      2
    )
  );

  // ==========================================================
  // Statistics
  // ==========================================================

  console.log(
    "\n================================="
  );

  console.log(
    "✓ Unified team graph generated!"
  );

  console.log(
    `Nodes: ${output.nodes.length}`
  );

  console.log(
    `Links: ${output.links.length}`
  );

  console.log(
    `Works: ${output.works.length}`
  );

  console.log(
    "================================="
  );

  // ==========================================================
  // Works by team member
  // ==========================================================

  console.log(
    "\nWorks by team member:"
  );

  for (const member of TEAM) {
    const count =
      allWorks.filter(
        (work) =>
          work.owner
            ?.orcid ===
          member.orcid
      ).length;

    console.log(
      `  ${member.name}: ${count}`
    );
  }

  // ==========================================================
  // Core team links
  // ==========================================================

  console.log(
    "\nCore team collaboration links:"
  );

  for (const link of links) {
    const sourceIsCore =
      TEAM.some(
        (member) =>
          member.orcid ===
          link.source
      );

    const targetIsCore =
      TEAM.some(
        (member) =>
          member.orcid ===
          link.target
      );

    if (
      sourceIsCore ||
      targetIsCore
    ) {
      console.log(
        `  ${link.source} → ${link.target} (${link.works.length} works)`
      );
    }
  }
}

// ============================================================
// Run
// ============================================================

buildUnifiedGraph().catch(
  (error) => {
    console.error(
      "\n✗ Fatal error while building graph:",
      error
    );

    process.exit(1);
  }
);