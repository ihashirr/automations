const { chromium } = require('playwright');
const fs = require('fs');
const { STATE_FILE, RAW_LEADS_FILE, DISCOVERED_POSTS_FILE } = require('../lib/config');
const { appendCsvRow, parseCsv } = require('../lib/csv');
const { delay, randomBetween } = require('../lib/utils');

async function run(args) {
  const targetAccountId = args[0] || 'default';
  const postUrlArg = args[1];
  const postContextArg = args[2];
  const maxScrolls = Number(process.env.MAX_SCROLLS || 5);

  if (!postUrlArg) {
    console.error("Usage: node main.js collect <accountId> auto  OR  node main.js collect <accountId> <post_url> '<post_context>'");
    process.exit(1);
  }

  const RAW_HEADERS = ['name', 'profile_url', 'headline', 'interaction', 'post_context', 'source_post_url'];

  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(`Missing state file: ${STATE_FILE}. Run auth first.`);
  }

  let tasks = [];
  if (postUrlArg === 'auto') {
    if (!fs.existsSync(DISCOVERED_POSTS_FILE)) {
      console.log(`[Collector] No discovered posts found at ${DISCOVERED_POSTS_FILE}. Run find first.`);
      return;
    }
    const posts = parseCsv(DISCOVERED_POSTS_FILE);
    for (let p of posts) {
      if (p.post_url) {
        tasks.push({ 
          url: p.post_url, 
          context: (p.query || 'auto_collected').replace(/^"|"$/g, '') 
        });
      }
    }
    console.log(`[Collector] Loaded ${tasks.length} posts from discovered_posts.csv (auto mode)`);
  } else {
    tasks.push({ url: postUrlArg, context: postContextArg || 'manual_collect' });
  }

  if (tasks.length === 0) {
    console.log('[Collector] No posts to process.');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: STATE_FILE });
  const page = await context.newPage();

  console.log(`[Collector] Starting engine for account: ${targetAccountId}`);
  let totalAdded = 0;

  for (let t = 0; t < tasks.length; t++) {
    const { url, context: tag } = tasks[t];
    console.log(`\n[Collector] Processing post ${t + 1}/${tasks.length}: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await delay(randomBetween(4000, 7000));
      
      console.log('   -> Scrolling to load comments...');
      for (let i = 0; i < maxScrolls; i++) {
        await page.mouse.wheel(0, randomBetween(600, 1000));
        await delay(randomBetween(2000, 3500));
      }

      console.log('   -> Extracting commenters...');
      const commentContainers = page.locator('article.comments-comment-item');
      const count = await commentContainers.count();
      
      let added = 0;
      for (let i = 0; i < count; i++) {
        try {
          const container = commentContainers.nth(i);
          const linkEl = container.locator('a.app-aware-link').first();
          if (!(await linkEl.isVisible())) continue;

          const profileUrl = (await linkEl.getAttribute('href')).split('?')[0];
          if (!profileUrl.includes('/in/')) continue;

          const innerText = await linkEl.innerText();
          const lines = innerText.split('\n').filter(l => l.trim().length > 0);
          if (lines.length === 0) continue;

          appendCsvRow(RAW_LEADS_FILE, RAW_HEADERS, {
            name: lines[0].trim(),
            profile_url: profileUrl,
            headline: lines.length > 1 ? lines[1].trim() : 'Unknown',
            interaction: 'comment',
            post_context: tag,
            source_post_url: url
          });
          added++;
        } catch (e) {}
      }
      console.log(`   ✓ Harvested ${added} commenters from this post.`);
      totalAdded += added;
      
      if (t < tasks.length - 1) {
        let waitTime = randomBetween(5000, 10000);
        console.log(`   -> Resting for ${Math.round(waitTime/1000)}s to avoid rate limits...`);
        await delay(waitTime);
      }
    } catch (err) {
      console.log(`   x Failed to process post:`, err.message);
    }
  }

  await browser.close();
  console.log(`\n[Collector] DONE! ✓ Appended a total of ${totalAdded} leads to raw_leads.csv`);
  console.log(`👉 Next: node main.js filter`);
}

module.exports = { run };
