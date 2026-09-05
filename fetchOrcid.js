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
    name: "Kristy Bourret",
    orcid: "0000-0003-4319-5728",
    role: "Team Member"
  }
];

const OUTPUT_FILE = "./src/app/data/network.json";


// ============================================================
// HTTP helper
// ============================================================

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {

    const options = {
      hostname,
      path,
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    };

    const req = https.request(options, (res) => {

      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${data.substring(0, 500)}`
            )
          );

          return;
        }

        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(
            new Error(
              `Invalid JSON response: ${error.message}`
            )
          );
        }
      });
    });

    req.on("error", reject);

    req.end();
  });
}


// ============================================================
// Fetch all works belonging to an ORCID
// ============================================================

async function fetchWorks(orcid) {

  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/works`
  );
}


// ============================================================
// Fetch detailed information for a specific work
// ============================================================

async function fetchWorkDetails(orcid, putCode) {

  return httpsGet(
    "pub.orcid.org",
    `/v3.0/${orcid}/work/${putCode}`
  );
}


// ============================================================
// Normalize names for matching
// ============================================================

function normalizeName(name) {

  if (!name) {
    return null;
  }

  return name
    .replace(/\u00A0/g, " ")
    .replace(/^dr\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}


// ============================================================
// Build lookup table for core team
// ============================================================

const TEAM_BY_NAME = new Map();

for (const member of TEAM) {

  const normalized =
    normalizeName(member.name);

  TEAM_BY_NAME.set(normalized, member);
}


// ============================================================
// Extract ORCID from contributor object
// ============================================================

function getContributorOrcid(contributor) {

  const contributorOrcid =
    contributor["contributor-orcid"];

  if (!contributorOrcid) {
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
    .replace("https://orcid.org/", "")
    .replace("http://orcid.org/", "")
    .trim()
    .toLowerCase();
}


// ============================================================
// Identify contributor
// ============================================================

function identifyContributor(contributor) {

  const name =
    contributor["credit-name"]?.value ||
    contributor["contributor-name"]?.value ||
    null;

  const orcid =
    getContributorOrcid(contributor);

  // ----------------------------------------------------------
  // First try ORCID
  // ----------------------------------------------------------

  if (orcid) {

    const teamMember =
      TEAM.find(
        member =>
          member.orcid.toLowerCase() === orcid
      );

    if (teamMember) {

      return {
        id: teamMember.orcid,
        name: teamMember.name,
        orcid: teamMember.orcid,
        teamMember: true
      };
    }
  }


  // ----------------------------------------------------------
  // Then try normalized name
  // ----------------------------------------------------------

  if (name) {

    const normalized =
      normalizeName(name);

    const teamMember =
      TEAM_BY_NAME.get(normalized);

    if (teamMember) {

      return {
        id: teamMember.orcid,
        name: teamMember.name,
        orcid: teamMember.orcid,
        teamMember: true
      };
    }
  }


  // ----------------------------------------------------------
  // External contributor
  // ----------------------------------------------------------

  return {
    id: orcid || normalizeName(name),
    name: name,
    orcid: orcid,
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

  if (!personA || !personB) {
    return;
  }

  if (!personA.id || !personB.id) {
    return;
  }

  if (personA.id === personB.id) {
    return;
  }


  // Stable ordering prevents A-B and B-A duplicates

  const [source, target] =
    personA.id < personB.id
      ? [personA.id, personB.id]
      : [personB.id, personA.id];

  const key =
    `${source}|${target}`;


  if (!collaborationMap.has(key)) {

    collaborationMap.set(key, {
      source,
      target,
      value: 0,
      works: []
    });
  }


  const link =
    collaborationMap.get(key);


  // Avoid counting the exact same work twice

  const alreadyAdded =
    link.works.some(
      existing =>
        existing.putCode === work.putCode
    );

  if (alreadyAdded) {
    return;
  }


  link.value += 1;

  link.works.push({
    putCode: work.putCode,
    title: work.title,
    year: work.year,
    journal: work.journal,
    doi: work.doi,
    url: work.url
  });
}


// ============================================================
// Main graph builder
// ============================================================

async function buildUnifiedGraph() {

  const nodes = new Map();

  const collaborationMap = new Map();


  // ==========================================================
  // Initialize core team nodes
  // ==========================================================

  for (const member of TEAM) {

    nodes.set(member.orcid, {

      id: member.orcid,

      name: member.name,

      role: member.role,

      group: 1,

      val: 25,

      color: "var(--arcand-primary)",

      desc:
        `Core Arcand Centre Team Member (ORCID: ${member.orcid})`,

      orcid: member.orcid
    });
  }


  // ==========================================================
  // Process every team member
  // ==========================================================

  for (const member of TEAM) {

    console.log(
      `Fetching works for ${member.name}...`
    );


    try {

      const data =
        await fetchWorks(member.orcid);

      const works =
        data.group || [];


      console.log(
        `${member.name}: ${works.length} works found`
      );


      // ======================================================
      // Process each work
      // ======================================================

      for (const workGroup of works) {

        const summary =
          workGroup["work-summary"]?.[0];

        if (!summary) {
          continue;
        }


        const putCode =
          summary["put-code"];

        if (!putCode) {

          console.log(
            `Skipping work without put-code: ${summary.title?.title?.value}`
          );

          continue;
        }


        // ====================================================
        // Fetch FULL work record
        // ====================================================

        let details;

        try {

          details =
            await fetchWorkDetails(
              member.orcid,
              putCode
            );

        } catch (error) {

          console.error(
            `Failed to fetch work ${putCode}:`,
            error.message
          );

          continue;
        }


        // ====================================================
        // Work metadata
        // ====================================================

        const title =
          details.title?.title?.value ||
          summary.title?.title?.value ||
          "Untitled";


        const year =
          details["publication-date"]?.year?.value ||
          null;


        const journal =
          details["journal-title"]?.value ||
          null;


        const url =
          details.url?.value ||
          null;


        let doi = null;


        const externalIds =
          details["external-ids"]?.["external-id"] || [];


        const doiEntry =
          externalIds.find(
            id =>
              id["external-id-type"]?.toLowerCase() === "doi"
          );


        if (doiEntry) {

          doi =
            doiEntry["external-id-value"] ||
            doiEntry["external-id-normalized"]?.value ||
            null;
        }


        // ====================================================
        // Contributors
        // ====================================================

        const contributors =
          details.contributors?.contributor || [];


        if (contributors.length === 0) {

          console.log(
            `No contributors: ${title}`
          );

          continue;
        }


        // ====================================================
        // Identify all contributors
        // ====================================================

        const people = [];


        for (const contributor of contributors) {

          const person =
            identifyContributor(contributor);


          if (!person.id || !person.name) {
            continue;
          }


          // --------------------------------------------------
          // Create external node
          // --------------------------------------------------

          if (!person.teamMember) {

            if (!nodes.has(person.id)) {

              nodes.set(person.id, {

                id: person.id,

                name: person.name,

                role: "Co-Author",

                group: 5,

                val: 5,

                color: "#800080",

                desc: "External Collaborator",

                orcid: person.orcid
              });
            }
          }


          people.push(person);
        }


        // ====================================================
        // Create pairwise collaborations
        // ====================================================

        for (let i = 0; i < people.length; i++) {

          for (let j = i + 1; j < people.length; j++) {

            addCollaboration(
              collaborationMap,
              people[i],
              people[j],
              {
                putCode,
                title,
                year,
                journal,
                doi,
                url
              }
            );
          }
        }


        console.log(
          `  ✓ ${title} (${people.length} contributors)`
        );
      }


      console.log(
        `✓ Finished ${member.name}`
      );

    } catch (error) {

      console.error(
        `✗ Failed to fetch ${member.name}:`,
        error.message
      );
    }
  }


  // ==========================================================
  // Convert collaboration map into links
  // ==========================================================

  const links =
    Array.from(
      collaborationMap.values()
    );


  // ==========================================================
  // Write JSON
  // ==========================================================

  if (!fs.existsSync("./src/app/data")) {

    fs.mkdirSync(
      "./src/app/data",
      {
        recursive: true
      }
    );
  }


  const output = {

    nodes:
      Array.from(nodes.values()),

    links
  };


  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(output, null, 2)
  );


  // ==========================================================
  // Summary
  // ==========================================================

  console.log("");
  console.log("=================================");
  console.log("✓ Unified team graph generated!");
  console.log(`Nodes: ${output.nodes.length}`);
  console.log(`Links: ${output.links.length}`);
  console.log("=================================");

}


buildUnifiedGraph();