const fs = require('fs');
const { DEALS_FILE } = require('../lib/config');
const { parseCsv } = require('../lib/csv');

async function run(args) {
  // USAGE: node main.js update <stage> "<name>" [reply_type]
  const action = args[0];
  const targetName = args[1];
  const replyType = args[2] || '';

  if (!action || !targetName) {
    console.log('Usage: node main.js update <action> "<name>" [reply_type]');
    console.log('Actions: accepted, replied, interested, call_booked, closed_won, closed_lost, do_not_follow_up');
    process.exit(1);
  }

  if (!fs.existsSync(DEALS_FILE)) {
    console.log('No deals.csv found. Run node main.js track first.');
    process.exit(1);
  }

  // Read raw file content to preserve formatting
  const content = fs.readFileSync(DEALS_FILE, 'utf8');
  const lines = content.split('\n');
  const header = lines[0];
  let updated = 0;

  // Rebuild file line by line
  const newLines = [header];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Parse the row
    const cols = [];
    let inQuotes = false;
    let col = '';
    for (let c = 0; c < lines[i].length; c++) {
      if (lines[i][c] === '"') inQuotes = !inQuotes;
      else if (lines[i][c] === ',' && !inQuotes) { cols.push(col); col = ''; }
      else col += lines[i][c];
    }
    cols.push(col);

    // Match by name (partial, case-insensitive)
    const name = cols[0] || '';
    if (name.toLowerCase().includes(targetName.toLowerCase())) {
      console.log(`[Update] Match: ${name}`);

      const act = action.toLowerCase();
      if (act === 'accepted' || act === 'connected') {
        cols[4] = 'connected';  // stage
        cols[5] = 'yes';        // acceptance_status
      } else if (act === 'replied') {
        cols[4] = 'replied';
        cols[6] = replyType.toLowerCase();
        cols[9] = new Date().toISOString(); // last_reply_at
      } else if (act === 'do_not_follow_up') {
        cols[13] = 'do_not_follow_up';
      } else {
        cols[4] = act; // interested, call_booked, closed_won, etc.
      }

      updated++;
    }

    // Rebuild row with proper quoting
    const rebuilt = cols.map(c => {
      const s = String(c);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
    newLines.push(rebuilt);
  }

  if (updated > 0) {
    fs.writeFileSync(DEALS_FILE, newLines.join('\n') + '\n');
    console.log(`✓ Updated ${updated} deal(s).`);
  } else {
    console.log(`No deals matching "${targetName}".`);
  }
}

module.exports = { run };
