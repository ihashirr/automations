const path = require('path');

// Account ID from CLI args (e.g., node main.js <command> <myaccount>)
// If running via main.js, process.argv[2] is the command and process.argv[3] is the accountId
const isMainCli = process.argv[1] && (process.argv[1].endsWith('main.js') || process.argv[1].endsWith('main'));
const accountId = isMainCli ? (process.argv[3] || 'default') : (process.argv[2] || 'default');

// Limits
const DAILY_SEND_CAP = Number(process.env.DAILY_SEND_CAP || 20);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STATE_DIR = path.join(ROOT_DIR, 'state');

// Data files (shared across accounts)
const LEADS_FILE = path.join(DATA_DIR, 'leads.csv');
const RAW_LEADS_FILE = path.join(DATA_DIR, 'raw_leads.csv');
const DEALS_FILE = path.join(DATA_DIR, 'deals.csv');
const LOG_FILE = path.join(DATA_DIR, 'run_log.csv');
const DISCOVERED_POSTS_FILE = path.join(DATA_DIR, 'discovered_posts.csv');

// State files (per-account)
const STATE_FILE = path.join(STATE_DIR, `state_${accountId}.json`);
const DAILY_STATE_FILE = path.join(STATE_DIR, `daily_state_${accountId}.json`);

module.exports = {
  accountId,
  DAILY_SEND_CAP,
  ROOT_DIR,
  DATA_DIR,
  STATE_DIR,
  LEADS_FILE,
  RAW_LEADS_FILE,
  DEALS_FILE,
  LOG_FILE,
  DISCOVERED_POSTS_FILE,
  STATE_FILE,
  DAILY_STATE_FILE,
};
