const { LOG_FILE, DEALS_FILE, LEADS_FILE } = require('../lib/config');
const { parseCsv, appendCsvRow } = require('../lib/csv');

const DEAL_HEADERS = ['name', 'profile_url', 'post_context', 'interaction', 'stage', 'acceptance_status', 'reply_type', 'priority_score', 'last_outreach_at', 'last_reply_at', 'next_followup_at', 'owner', 'notes', 'status'];

// Follow-up Variant Arrays
const DAY2 = [
  "Curious if this is still something you're dealing with?",
  "Worth exploring or already solved on your side?",
  "Just floating this back up — still an active priority for you?",
  "Checking back in. Are you guys currently figuring this out?"
];
const DAY5 = [
  "Most teams I speak to lose leads here — wondering if it's similar for you?",
  "Feels like one of those silent problems — does it show up for you?",
  "Usually when I see engagement on threads like that, it means someone is patching a leaky funnel. Is that you?",
  "Are you still looking at solutions or did you end up building something internally?"
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function calcPriority(interaction, headline) {
  let s = 0;
  const hl = (headline || '').toLowerCase();
  if (interaction === 'comment') s += 5;
  if (hl.includes('founder') || hl.includes('ceo') || hl.includes('coo')) s += 5;
  if (hl.includes('director') || hl.includes('vp') || hl.includes('head')) s += 3;
  if (hl.includes('owner')) s += 4;
  return s || 1;
}

// 1. Sync new outreached leads into deals pipeline
function sync() {
  const logRows = parseCsv(LOG_FILE);
  const leadsRows = parseCsv(LEADS_FILE);
  const existingDeals = new Set(parseCsv(DEALS_FILE).map(r => r.name));

  const lookup = {};
  leadsRows.forEach(r => { lookup[r.name] = r; });

  let added = 0;
  logRows.forEach(r => {
    if (r.status === 'success' && !existingDeals.has(r.name)) {
      const meta = lookup[r.name] || {};
      const d2 = new Date(r.timestamp);
      d2.setDate(d2.getDate() + 2);

      appendCsvRow(DEALS_FILE, DEAL_HEADERS, {
        name: r.name,
        profile_url: meta.profile_url || '',
        post_context: meta.post_context || '',
        interaction: meta.interaction || 'unknown',
        stage: 'sent',
        acceptance_status: 'no',
        reply_type: '',
        priority_score: calcPriority(meta.interaction, meta.headline),
        last_outreach_at: new Date(r.timestamp).toISOString(),
        last_reply_at: '',
        next_followup_at: d2.toISOString(),
        owner: r.account || '',
        notes: '',
        status: 'active'
      });
      existingDeals.add(r.name);
      added++;
    }
  });

  if (added > 0) console.log(`[Sync] Added ${added} new deals.`);
}

// 2. Generate daily hitlist
function hitlist() {
  const deals = parseCsv(DEALS_FILE);
  const now = new Date();
  const day2 = [], day5 = [];

  deals.forEach(d => {
    if ((d.stage === 'sent' || d.stage === 'connected') && d.status === 'active' && d.last_outreach_at) {
      const diff = Math.ceil(Math.abs(now - new Date(d.last_outreach_at)) / (1000 * 60 * 60 * 24));
      const score = Number(d.priority_score) || 1;
      const entry = { name: d.name, context: d.post_context, diff, score };

      if (diff >= 5) day5.push(entry);
      else if (diff >= 2) day2.push(entry);
    }
  });

  day2.sort((a, b) => b.score - a.score);
  day5.sort((a, b) => b.score - a.score);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`  DAILY ACTION LIST`);
  console.log(`${'='.repeat(40)}`);

  if (day2.length) {
    console.log(`\n🔥 DAY 2 FOLLOW-UPS (${day2.length})`);
    day2.forEach(c => {
      console.log(`   ${c.name} | Score: ${c.score}/10 | ${c.diff}d ago`);
      console.log(`   → "${pick(DAY2)}"`);
      console.log();
    });
  } else console.log('\n✅ No Day 2 follow-ups.');

  if (day5.length) {
    console.log(`\n☠️  DAY 5 URGENT (${day5.length})`);
    day5.forEach(c => {
      console.log(`   ${c.name} | Score: ${c.score}/10 | ${c.diff}d ago`);
      console.log(`   → "${pick(DAY5)}"`);
      console.log();
    });
  } else console.log('✅ No Day 5 follow-ups.');

  console.log(`👉 node main.js update <stage> "<name>" [reply_type]`);
}

async function run(args) {
  sync();
  hitlist();
}

module.exports = { run };
