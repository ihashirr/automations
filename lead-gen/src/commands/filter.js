const { LEADS_FILE, RAW_LEADS_FILE } = require('../lib/config');
const { parseCsv, appendCsvRow } = require('../lib/csv');

const NEGATIVE_KEYWORDS = ['student', 'intern', 'hr', 'recruiter', 'talent', 'seeking', 'looking', 'hiring'];
const LEADS_HEADERS = ['name', 'profile_url', 'headline', 'interaction', 'post_context', 'source_post_url'];

async function run(args) {
  const rawLeads = parseCsv(RAW_LEADS_FILE);
  if (rawLeads.length === 0) {
    console.log('[Filter] No raw_leads.csv found or empty. Run node main.js collect first.');
    return;
  }

  console.log(`[Filter] Processing ${rawLeads.length} raw leads...`);

  // 1. Discard negative keywords + weak likes
  let filtered = rawLeads.filter(lead => {
    const hl = (lead.headline || '').toLowerCase();

    if (NEGATIVE_KEYWORDS.some(kw => hl.includes(kw))) {
      console.log(`   [Drop] ${lead.name} (negative keyword)`);
      return false;
    }

    if ((lead.interaction || '').toLowerCase() !== 'comment') {
      if (!hl.includes('founder') && !hl.includes('ceo') && !hl.includes('coo')) {
        console.log(`   [Drop] ${lead.name} (weak like)`);
        return false;
      }
    }

    return true;
  });

  // 2. Priority sort: comments first
  filtered.sort((a, b) => {
    if (a.interaction === 'comment' && b.interaction !== 'comment') return -1;
    if (a.interaction !== 'comment' && b.interaction === 'comment') return 1;
    return 0;
  });

  // 3. Deduplicate against existing leads.csv
  const existing = new Set(parseCsv(LEADS_FILE).map(l => l.profile_url));
  let added = 0;

  filtered.forEach(l => {
    if (!existing.has(l.profile_url)) {
      appendCsvRow(LEADS_FILE, LEADS_HEADERS, l);
      existing.add(l.profile_url);
      added++;
    }
  });

  console.log(`\n[Filter] Raw: ${rawLeads.length} | Dropped: ${rawLeads.length - filtered.length} | Added: ${added}`);
}

module.exports = { run };
