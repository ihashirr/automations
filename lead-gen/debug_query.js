const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const stateFile = path.join(__dirname, 'state/state_ihashirr.json');
  console.log(`Using state file: ${stateFile}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: stateFile });
  const page = await context.newPage();

  const url = 'https://www.linkedin.com/posts/digitaltransformation-innovationinbusiness-ugcPost-7446614340205486080-JuX5';
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Scroll a bit
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(2000);

  // Look for any comments
  const articles = await page.$$eval('article', elements => {
    return elements.map(el => ({
      className: el.className,
      text: el.innerText.substring(0, 50).replace(/\n/g, ' ')
    }));
  });

  await page.screenshot({ path: 'debug_comments.png', fullPage: true });

  await page.screenshot({ path: 'debug_comments.png', fullPage: true });

  const buttons = await page.$$eval('button', elements => elements.map(el => el.innerText.trim()).filter(Boolean));
  const spans = await page.$$eval('span', elements => elements.map(el => el.innerText.trim()).filter(Boolean));
  const fs = require('fs');
  fs.writeFileSync('debug_output.json', JSON.stringify({ buttons: buttons.slice(0, 50), spans: spans.slice(0, 50) }, null, 2));

  await browser.close();
})();
