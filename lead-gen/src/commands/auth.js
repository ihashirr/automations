const { chromium } = require('playwright');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

async function run(args) {
  const accountId = args[0] || 'default';
  const ROOT_DIR = path.resolve(__dirname, '../..');
  const STATE_DIR = path.join(ROOT_DIR, 'state');
  
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const stateFile = path.join(STATE_DIR, `state_${accountId}.json`);

  function waitForEnter() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      rl.question(`After logging in, press Enter to save to ${stateFile} and exit... `, () => {
        rl.close();
        resolve();
      });
    });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  console.log(`Logging in for account: ${accountId}`);
  console.log('Please log in manually in the opened browser window.');

  await waitForEnter();
  await context.storageState({ path: stateFile });

  await browser.close();
  console.log(`Saved session to ${stateFile}`);
}

module.exports = { run };
