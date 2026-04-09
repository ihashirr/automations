const fs = require('fs');
const { DAILY_STATE_FILE } = require('./config');
const { getLocalDateKey } = require('./utils');

function loadDailyState() {
  const today = getLocalDateKey();
  if (!fs.existsSync(DAILY_STATE_FILE)) return { date: today, sentCount: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(DAILY_STATE_FILE));
    if (data.date !== today) return { date: today, sentCount: 0 };
    return data;
  } catch {
    return { date: today, sentCount: 0 };
  }
}

function saveDailyState(state) {
  fs.writeFileSync(DAILY_STATE_FILE, JSON.stringify(state, null, 2));
}

module.exports = { loadDailyState, saveDailyState };
