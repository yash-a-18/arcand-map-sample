const fs = require('fs');
const https = require('https');

const TEAM = [
  { name: "Dr. Erin Cameron", orcid: "0000-0002-3529-9247", role: "Director" },
  { name: "Alex Anawati", orcid: "0000-0001-5767-3781", role: "Team Member" },
  { name: "Joseph LeBlanc", orcid: "0009-0005-3887-033X", role: "Team Member" },
  { name: "Brianne Wood", orcid: "0000-0001-9958-4824", role: "Team Member" },
  { name: "Kristy Bourret", orcid: "0000-0003-4319-5728", role: "Team Member" }
];
const OUTPUT_FILE = "./src/app/data/network.json";

function fetchWorks(orcid) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'pub.orcid.org',
      path: `/v3.0/${orcid}/works`,
      headers: { 'Accept': 'application/json' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function buildUnifiedGraph() {
  const nodes = new Map();
  const links = [];

  // Initialize core team nodes
  TEAM.forEach(member => {
    nodes.set(member.name, {
      id: member.name,
      role: member.role,
      group: 1,
      val: 25,
      color: "var(--arcand-primary)",
      desc: `Core Arcand Centre Team Member (ORCID: ${member.orcid})`
    });
  });

  for (const member of TEAM) {
    try {
      const data = await fetchWorks(member.orcid);
      const works = data.group || [];
      
      works.forEach((work) => {
        const summary = work['work-summary'][0];
        if (summary.contributors && summary.contributors.contributor) {
          summary.contributors.contributor.forEach((contributor) => {
            const authorName = contributor['credit-name']?.value;
            
            if (authorName && !TEAM.find(t => authorName.includes(t.name.split(' ').pop()))) {
              // Add external co-author node if it doesn't exist
              if (!nodes.has(authorName)) {
                nodes.set(authorName, {
                  id: authorName,
                  role: "Co-Author",
                  group: 5,
                  val: 5,
                  color: "#800080",
                  desc: "External Collaborator"
                });
              }
              // Link core member to co-author
              links.push({ source: member.name, target: authorName });
            }
          });
        }
      });
      console.log(`Fetched data for ${member.name}`);
    } catch (error) {
      console.error(`Failed to fetch for ${member.name}:`, error);
    }
  }

  if (!fs.existsSync('./src/app/data')) fs.mkdirSync('./src/app/data', { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ nodes: Array.from(nodes.values()), links }, null, 2));
  console.log("✅ Unified team graph generated!");
}

buildUnifiedGraph();