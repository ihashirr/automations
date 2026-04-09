const { LOG_FILE } = require('./config');
const { appendCsvRow, parseCsv } = require('./csv');

const LOG_HEADERS = ['timestamp', 'account', 'name', 'headline', 'status', 'reason', 'sent_count'];

function appendRunLog(entry) {
  appendCsvRow(LOG_FILE, LOG_HEADERS, entry);
}

function getProcessedLeadNames() {
  const rows = parseCsv(LOG_FILE);
  const processed = new Set();
  for (const row of rows) {
    if (row.status === 'success' && row.name) {
      processed.add(row.name.trim());
    }
  }
  return processed;
}

module.exports = { appendRunLog, getProcessedLeadNames };
