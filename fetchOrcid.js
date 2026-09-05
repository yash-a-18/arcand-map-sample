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
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// ============================================================
// ORCID Fetchers
// ============================================================
async function fetchWorks(orcid) {
  return httpsGet("pub.orcid.org", `/v3.0/${orcid}/works`);
}

async function fetchWorkDetails(orcid, putCode) {
  return httpsGet("pub.orcid.org", `/v3.0/${orcid}/work/${putCode}`);
}

async function fetchPerson(orcid) {
  return httpsGet("pub.orcid.org", `/v3.0/${orcid}/person`);
}

async function fetchEmployments(orcid) {
  return httpsGet("pub.orcid.org", `/v3.0/${orcid}/employments`);
}

async function fetchFundings(orcid) {
  return httpsGet("pub.orcid.org", `/v3.0/${orcid}/fundings`);
}

// ============================================================
// Normalization & Helpers
// ============================================================
function normalizeName(name) {
  if (!name) return null;
  return name.replace(/\u00A0/g, " ").replace(/^dr\.?\s+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const TEAM_BY_NAME = new Map();
for (const member of TEAM) {
  TEAM_BY_NAME.set(normalizeName(member.name), member);
}

function getContributorOrcid(contributor) {
  const contributorOrcid = contributor["contributor-orcid"];
  if (!contributorOrcid) return null;
  let value = contributorOrcid.uri || contributorOrcid.path || null;
  if (!value) return null;
  return value.replace("https://orcid.org/", "").replace("http://orcid.org/", "").trim().toLowerCase();
}

function identifyContributor(contributor) {
  const name = contributor["credit-name"]?.value || contributor["contributor-name"]?.value || null;
  const orcid = getContributorOrcid(contributor);

  if (orcid) {
    const teamMember = TEAM.find(member => member.orcid.toLowerCase() === orcid);
    if (teamMember) return { id: teamMember.orcid, name: teamMember.name, orcid: teamMember.orcid, teamMember: true };
  }

  if (name) {
    const normalized = normalizeName(name);
    const teamMember = TEAM_BY_NAME.get(normalized);
    if (teamMember) return { id: teamMember.orcid, name: teamMember.name, orcid: teamMember.orcid, teamMember: true };
  }

  return { id: orcid || normalizeName(name), name: name, orcid: orcid, teamMember: false };
}

function addCollaboration(collaborationMap, personA, personB, work) {
  if (!personA || !personB || !personA.id || !personB.id || personA.id === personB.id) return;

  const [source, target] = personA.id < personB.id ? [personA.id, personB.id] : [personB.id, personA.id];
  const key = `${source}|${target}`;

  if (!collaborationMap.has(key)) {
    collaborationMap.set(key, { source, target, value: 0, works: [] });
  }

  const link = collaborationMap.get(key);
  const alreadyAdded = link.works.some(existing => existing.putCode === work.putCode);

  if (alreadyAdded) return;

  link.value += 1;
  link.works.push({
    putCode: work.putCode, title: work.title, year: work.year, journal: work.journal, doi: work.doi, url: work.url
  });
}

// ============================================================
// Main graph builder
// ============================================================
async function buildUnifiedGraph() {
  const nodes = new Map();
  const collaborationMap = new Map();

  // Initialize core team nodes
  for (const member of TEAM) {
    nodes.set(member.orcid, {
      id: member.orcid,
      name: member.name,
      role: member.role,
      group: 1,
      val: 25,
      color: "var(--arcand-primary)",
      desc: `Core Arcand Centre Team Member (ORCID: ${member.orcid})`,
      orcid: member.orcid,
      about: null,
      employments: [],
      fundings: []
    });
  }

  // Process every team member
  for (const member of TEAM) {
    console.log(`\nProcessing data for ${member.name}...`);
    const nodeRef = nodes.get(member.orcid);

    // 1. Fetch Biography / About Info
    try {
      const personData = await fetchPerson(member.orcid);
      nodeRef.about = personData?.biography?.content || null;
    } catch (error) {
      console.error(`  ✗ Failed to fetch biography for ${member.name}:`, error.message);
    }

    // 2. Fetch Employments & Roles
    try {
      const empData = await fetchEmployments(member.orcid);
      const empGroups = empData['affiliation-group'] || [];
      
      for (const group of empGroups) {
        // Fix: ORCID v3 API nests the employment summary inside a 'summaries' array
        const summaries = group.summaries || [];
        
        for (const item of summaries) {
          const summary = item['employment-summary'];
          if (summary) {
            nodeRef.employments.push({
              role: summary['role-title'] || null,
              organization: summary.organization?.name || null,
              startDate: summary['start-date']?.year?.value || null,
              endDate: summary['end-date']?.year?.value || "Present"
            });
          }
        }
      }
    } catch (error) {
      console.error(`  ✗ Failed to fetch employments for ${member.name}:`, error.message);
    }

    // 3. Fetch Grants & Funding
    try {
      const fundData = await fetchFundings(member.orcid);
      const fundGroups = fundData.group || [];
      for (const group of fundGroups) {
        const summaries = group['funding-summary'] || [];
        for (const summary of summaries) {
          nodeRef.fundings.push({
            title: summary.title?.title?.value || "Untitled Funding",
            type: summary.type || null,
            organization: summary.organization?.name || null,
            year: summary['start-date']?.year?.value || null,
            amount: summary.amount ? `${summary.amount.value} ${summary.amount['currency-code']}` : null
          });
        }
      }
    } catch (error) {
      console.error(`  ✗ Failed to fetch fundings for ${member.name}:`, error.message);
    }

    // 4. Fetch Works & Collaborations
    try {
      const data = await fetchWorks(member.orcid);
      const works = data.group || [];
      console.log(`  ${member.name}: ${works.length} works found`);

      for (const workGroup of works) {
        const summary = workGroup["work-summary"]?.[0];
        if (!summary) continue;

        const putCode = summary["put-code"];
        if (!putCode) continue;

        let details;
        try {
          details = await fetchWorkDetails(member.orcid, putCode);
        } catch (error) {
          console.error(`  ✗ Failed to fetch work ${putCode}:`, error.message);
          continue;
        }

        const title = details.title?.title?.value || summary.title?.title?.value || "Untitled";
        const year = details["publication-date"]?.year?.value || null;
        const journal = details["journal-title"]?.value || null;
        const url = details.url?.value || null;
        let doi = null;

        const externalIds = details["external-ids"]?.["external-id"] || [];
        const doiEntry = externalIds.find(id => id["external-id-type"]?.toLowerCase() === "doi");
        if (doiEntry) {
          doi = doiEntry["external-id-value"] || doiEntry["external-id-normalized"]?.value || null;
        }

        const contributors = details.contributors?.contributor || [];
        if (contributors.length === 0) continue;

        const people = [];
        for (const contributor of contributors) {
          const person = identifyContributor(contributor);
          if (!person.id || !person.name) continue;

          if (!person.teamMember && !nodes.has(person.id)) {
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
          people.push(person);
        }

        for (let i = 0; i < people.length; i++) {
          for (let j = i + 1; j < people.length; j++) {
            addCollaboration(collaborationMap, people[i], people[j], {
              putCode, title, year, journal, doi, url
            });
          }
        }
      }
      console.log(`  ✓ Finished processing ${member.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to fetch works for ${member.name}:`, error.message);
    }
  }

  // Convert collaboration map into links
  const links = Array.from(collaborationMap.values());

  // Write JSON
  if (!fs.existsSync("./src/app/data")) {
    fs.mkdirSync("./src/app/data", { recursive: true });
  }

  const output = {
    nodes: Array.from(nodes.values()),
    links
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log("\n=================================");
  console.log("✓ Unified team graph generated!");
  console.log(`Nodes: ${output.nodes.length}`);
  console.log(`Links: ${output.links.length}`);
  console.log("=================================");
}

buildUnifiedGraph();