const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { DISCOVERED_POSTS_FILE, STATE_DIR } = require('../lib/config');
const { appendCsvRow } = require('../lib/csv');
const { delay, randomBetween } = require('../lib/utils');

async function setupContext(targetAccountId) {
  const stateFile = path.join(STATE_DIR, `state_${targetAccountId}.json`);
  if (!fs.existsSync(stateFile)) {
    throw new Error(`Missing state file: ${stateFile}. Run 'node main.js auth ${targetAccountId}' first.`);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: stateFile,
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  
  return { browser, context, page };
}

async function navigateToSearch(page, searchQuery) {
  const searchUrl = searchQuery.startsWith('http') 
    ? searchQuery 
    : `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(searchQuery)}`;
    
  console.log(`[Finder] Navigating to: "${searchQuery}"`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await delay(randomBetween(3000, 7000));

  console.log(`[Finder] Checking for 'Show all post results' link...`);
  const showAllBtn = page.locator('text="Show all post results"').first();
  if (await showAllBtn.isVisible().catch(() => false)) {
    console.log(`[Finder] Clicking 'Show all post results'...`);
    await showAllBtn.click();
    await delay(randomBetween(3000, 7000));
  }
}

async function smoothScrollToLoadPosts(page, menuBtnSelector, maxPosts) {
  console.log(`[Finder] Scrolling to load up to ${maxPosts} posts...`);
  let scrollAttempts = 0;
  
  // Scroll dynamically until we find enough posts or hit a reasonable limit
  while (scrollAttempts < 30) {
    const currentCount = await page.locator(menuBtnSelector).count();
    if (currentCount >= maxPosts) {
      break;
    }
    
    // Smooth human-like scroll
    const targetScroll = randomBetween(1500, 2500);
    let scrolled = 0;
    while (scrolled < targetScroll) {
      const step = randomBetween(100, 300);
      await page.mouse.wheel(0, step);
      await delay(randomBetween(50, 150));
      scrolled += step;
    }
    
    await delay(randomBetween(1000, 2000)); // Natural pause after a scrolling burst
    scrollAttempts++;
  }
}

async function extractHeadline(btn) {
  return await btn.evaluate(b => {
    const postContainer = b.closest('.feed-shared-update-v2') || b.closest('.update-components-article-first-party') || b.closest('.search-result__occluded-item') || b.closest('li') || b;
    const link = postContainer.querySelector('a[href*="/in/"]');
    if (link) {
      const lines = (link.closest('div')?.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
      return lines.length > 1 ? lines[1] : 'Unknown';
    }
    return 'Unknown';
  });
}

async function extractEngagement(btn) {
  return await btn.evaluate(b => {
    const postContainer = b.closest('.feed-shared-update-v2') || b.closest('.update-components-article-first-party') || b.closest('.search-result__occluded-item') || b.closest('li') || b;
    const text = postContainer.innerText || '';
    const r = text.match(/([\d,.]+)\s+(reaction|like)s?/i);
    const c = text.match(/([\d,.]+)\s+comments?/i);
    return { reactions: r ? r[1] : '0', comments: c ? c[1] : '0' };
  });
}

async function extractAndSavePosts(page, menuBtnSelector, maxPosts, searchQuery) {
  const POST_HEADERS = ['timestamp', 'author', 'headline', 'reactions', 'comments', 'post_url', 'query'];
  const moreButtons = page.locator(menuBtnSelector);
  const count = await moreButtons.count();
  console.log(`[Finder] Found ${count} posts. Extracting up to ${maxPosts}...`);

  const seen = new Set();
  let found = 0;

  for (let i = 0; i < Math.min(count, maxPosts); i++) {
    try {
      const btn = moreButtons.nth(i);
      const ariaLabel = await btn.getAttribute('aria-label');
      const authorName = ariaLabel ? ariaLabel.replace('Open control menu for post by ', '').trim() : 'Unknown';

      await btn.scrollIntoViewIfNeeded();
      await delay(randomBetween(500, 1200));
      await btn.click();
      await delay(randomBetween(800, 1500));

      const copyBtn = page.locator('div[role="menuitem"]').filter({ hasText: 'Copy link to post' }).first();
      if (!(await copyBtn.isVisible().catch(() => false))) {
        await page.keyboard.press('Escape');
        await delay(500);
        continue;
      }

      await copyBtn.click();
      await delay(1000);

      const postUrl = await page.evaluate(() => navigator.clipboard.readText());
      if (!postUrl || !postUrl.includes('linkedin.com') || seen.has(postUrl)) continue;
      seen.add(postUrl);

      const headline = await extractHeadline(btn);
      const engagement = await extractEngagement(btn);

      appendCsvRow(DISCOVERED_POSTS_FILE, POST_HEADERS, {
        timestamp: new Date().toISOString(),
        author: authorName,
        headline,
        reactions: engagement.reactions,
        comments: engagement.comments,
        post_url: postUrl.trim(),
        query: searchQuery
      });

      found++;
      console.log(`   ✓ [${found}] ${authorName} | ${engagement.comments} comments`);
      await delay(randomBetween(500, 1000));
    } catch (e) {
      await page.keyboard.press('Escape').catch(() => {});
      await delay(500);
    }
  }

  return found;
}

async function run(args) {
  const targetAccountId = args[0] || 'default';
  const searchQuery = args[1];
  const maxPosts = Number(args[2] || 10);

  if (!searchQuery) {
    console.error('Usage: node main.js find <accountId> "<search_query>" [max_posts]');
    process.exit(1);
  }

  const { browser, context, page } = await setupContext(targetAccountId);

  await navigateToSearch(page, searchQuery);

  const menuBtnSelector = 'button[aria-label*="Open control menu for post by"]';
  await smoothScrollToLoadPosts(page, menuBtnSelector, maxPosts);

  const found = await extractAndSavePosts(page, menuBtnSelector, maxPosts, searchQuery);

  await browser.close();

  console.log(`\n[Finder] Done. ${found} posts saved to data/discovered_posts.csv`);
  if (found > 0) console.log(`👉 Next: node main.js collect ${targetAccountId} "<post_url>" "intent_tag"`);
}

module.exports = { run };
