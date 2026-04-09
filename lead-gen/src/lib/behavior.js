const { randomBetween, delay } = require('./utils');

async function simulateHuman(page) {
  // initial scroll down
  await page.mouse.wheel(0, randomBetween(300, 1200));
  await delay(randomBetween(1500, 4000));

  // Randomly hover somewhere
  if (Math.random() > 0.4) {
    await page.mouse.move(randomBetween(200, 900), randomBetween(200, 700));
    await delay(randomBetween(500, 2000));
  }

  // scroll up a bit
  if (Math.random() > 0.5) {
    await page.mouse.wheel(0, randomBetween(-100, -800));
    await delay(randomBetween(1000, 3000));
  }
}

async function simulateFeed(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await delay(randomBetween(5000, 15000));

  if (Math.random() > 0.5) {
    const posts = page.locator('div.feed-shared-update-v2');
    const count = await posts.count();

    if (count > 0) {
      const randomPostIndex = Math.floor(Math.random() * count);
      const randomPost = posts.nth(randomPostIndex);
      
      try {
        await randomPost.scrollIntoViewIfNeeded();
        await delay(randomBetween(3000, 7000));
        
        // 20% chance to like the post (Level 7 warmth layer)
        if (Math.random() > 0.8) {
          const likeBtn = randomPost.locator('button[aria-label^="Like"]').first();
          if (await likeBtn.isVisible()) {
            await likeBtn.click();
            await delay(randomBetween(2000, 4000));
          }
        }
      } catch(e) {}
    }
  }
}

// Level 10 / 1: reading simulation
async function thinkingTime() {
  await delay(randomBetween(8000, 20000));
}

module.exports = { simulateHuman, simulateFeed, thinkingTime };
