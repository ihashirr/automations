const fs = require('fs');

/**
 * Quote-aware CSV parser.
 * Handles commas inside quoted fields and escaped double-quotes.
 * Returns an array of objects keyed by the header row.
 */
function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8').trim();
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseRow(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ? cols[idx].replace(/^"|"$/g, '') : '';
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * Parse a single CSV row, respecting quoted fields.
 */
function parseRow(line) {
  const cols = [];
  let inQuotes = false;
  let col = '';

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ',' && !inQuotes) {
      cols.push(col);
      col = '';
    } else {
      col += line[i];
    }
  }
  cols.push(col);
  return cols;
}

/**
 * Append a row to a CSV file with proper quoting.
 * If the file doesn't exist, writes the header first.
 */
function appendCsvRow(filePath, headers, rowObj) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, headers.join(',') + '\n');
  }

  const row = headers.map(h => {
    const val = String(rowObj[h] || '');
    return val.includes(',') || val.includes('"')
      ? `"${val.replace(/"/g, '""')}"`
      : val;
  }).join(',');

  fs.appendFileSync(filePath, row + '\n');
}

module.exports = { parseCsv, parseRow, appendCsvRow };
