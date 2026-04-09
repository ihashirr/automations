const { chromium } = require('playwright');
const fs = require('fs');

const { accountId, DAILY_SEND_CAP, LEADS_FILE, STATE_FILE } = require('../lib/config');
const { randomBetween, delay } = require('../lib/utils');
const { parseCsv } = require('../lib/csv');
const { appendRunLog, getProcessedLeadNames } = require('../lib/logger');
const { loadDailyState, saveDailyState } = require('../lib/state');
const { generateMessage } = require('../lib/message');
const { simulateHuman, simulateFeed, thinkingTime } = require('../lib/behavior');

async function processLead(page, lead) {
  await page.goto(lead.profile_url, { waitUntil: 'domcontentloaded' });

  await thinkingTime();
  await simulateHuman(page);

  const behaviorRoll = Math.random();

  if (behaviorRoll < 0.1) {
    console.log(`   [Behavior] Feed detour`);
    await simulateFeed(page);
    return { status: 'skipped', reason: 'behavior_feed' };
  } else if (behaviorRoll < 0.3) {
    console.log(`   [Behavior] Idle (distracted)`);
    await delay(randomBetween(20000, 60000));
    return { status: 'skipped', reason: 'behavior_idle' };
  } else if (behaviorRoll < 0.6) {
    console.log(`   [Behavior] Browse only`);
    return { status: 'skipped_browse', reason: 'behavior_browse' };
  }

  const connectBtn = page.locator('button:has-text("Connect")').first();
  if (!(await connectBtn.count())) return { status: 'skipped', reason: 'no_connect' };
  if (!(await connectBtn.isVisible().catch(() => false))) return { status: 'skipped', reason: 'hidden_connect' };

  await connectBtn.click();
  await delay(randomBetween(1000, 2000));

  const noteBtn = page.locator('button:has-text("Add a note")').first();
  if (!(await noteBtn.isVisible().catch(() => false))) return { status: 'skipped', reason: 'no_note' };

  await noteBtn.click();
  const textarea = page.locator('textarea').first();
  await textarea.fill(generateMessage(lead));
  await delay(randomBetween(1500, 4000));
  await page.locator('button:has-text("Send")').first().click();

  return { status: 'success', reason: 'sent' };
}

async function run(args) {
  console.log(`[Outreach] Starting outreach...`);

  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(`Missing state file: ${STATE_FILE}. Run 'node main.js auth ${accountId}' first.`);
  }

  const SESSION_LIMIT = Math.floor(randomBetween(5, 15));
  let sessionActions = 0;
  console.log(`[Outreach] Session limit: ${SESSION_LIMIT} leads`);

  const leads = parseCsv(LEADS_FILE);
  const processed = getProcessedLeadNames();
  const pending = leads.filter(l => !processed.has(l.name));
  console.log(`[Outreach] ${pending.length} leads in queue (${processed.size} already processed)`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: STATE_FILE });
  const page = await context.newPage();
  const dailyState = loadDailyState();

  for (const lead of pending) {
    if (dailyState.sentCount >= DAILY_SEND_CAP) { console.log(`[Cap] Daily limit reached.`); break; }
    if (sessionActions >= SESSION_LIMIT) { console.log(`[Session] Limit reached. Exiting.`); break; }

    console.log(`\n→ ${lead.name}`);
    sessionActions++;
    const result = await processLead(page, lead);

    if (result.status === 'success') {
      dailyState.sentCount++;
      saveDailyState(dailyState);
      console.log(`   ✓ Sent (${dailyState.sentCount}/${DAILY_SEND_CAP} today)`);
    } else {
      console.log(`   ✗ ${result.reason}`);
    }

    appendRunLog({
      timestamp: new Date().toISOString(),
      account: accountId,
      name: lead.name,
      headline: lead.headline,
      status: result.status,
      reason: result.reason,
      sent_count: dailyState.sentCount
    });

    await delay(randomBetween(20000, 45000));
  }

  await browser.close();
  console.log('[Outreach] Done.');
}

module.exports = { run };
