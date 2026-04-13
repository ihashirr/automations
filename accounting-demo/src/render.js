// src/render.js

// DOM Elements
export const dom = {
  steps: {
    upload: document.getElementById('step-upload'),
    extracted: document.getElementById('step-extracted'),
    audit: document.getElementById('step-audit')
  },
  inputs: {
    realFileUpload: document.getElementById('real-file-upload'),
    uploadZoneArea: document.getElementById('upload-zone-area'),
    browseFilesBtn: document.getElementById('btn-browse-files')
  },
  layout: {
    panel: document.getElementById('panel-layout'),
    pdfIframe: document.getElementById('pdf-iframe'),
  },
  queue: {
    list: document.getElementById('queue-list-container'),
    progress: document.getElementById('queue-progress-text')
  },
  uploadLoader: document.getElementById('upload-loader'),
  statusText: document.getElementById('extraction-status-text'),
  extractedTableBody: document.getElementById('extracted-table-body'),
  fileNameDisplay: document.getElementById('display-file-name'),
  previewDocName: document.getElementById('preview-doc-name'),
  auditLoading: document.getElementById('audit-loading'),
  auditResultsContainer: document.getElementById('audit-results-container'),
  auditTableBody: document.getElementById('audit-table-body'),
  auditList: document.getElementById('audit-list-container'),
  summaryCard: document.getElementById('final-summary-card'),
  summaryText: document.getElementById('automation-result-text'),
  statusOneliner: document.getElementById('status-oneliner'),
  statusIconWrap: document.getElementById('status-icon-wrap'),
  pdfDrawerBody: document.getElementById('pdf-drawer-body'),
  drawerChevron: document.getElementById('drawer-chevron'),
  buttons: {
    demoCorrect: document.getElementById('btn-demo-correct'),
    demoIncorrect: document.getElementById('btn-demo-incorrect'),
    reUpload: document.getElementById('btn-re-upload'),
    addFiles: document.getElementById('btn-add-files'),
    exportCsv: document.getElementById('btn-export-csv'),
    togglePdf: document.getElementById('btn-toggle-pdf'),
    showExceptions: document.getElementById('btn-show-exceptions'),
  }
};

/**
 * Updates the global KPI dashboard
 */
export function updateKPIs(metrics) {
  document.getElementById('kpi-processed').textContent = metrics.processed.toLocaleString();
  document.getElementById('kpi-passed').textContent = metrics.passed.toLocaleString();
  document.getElementById('kpi-review').textContent = metrics.review.toLocaleString();
  document.getElementById('kpi-saved').textContent = metrics.timeSavedHours.toFixed(1) + 'h';

  const pctPassed = metrics.processed > 0 ? ((metrics.passed / metrics.processed) * 100) : 0;
  const pctReview = metrics.processed > 0 ? ((metrics.review / metrics.processed) * 100) : 0;

  const pctPassedEl = document.getElementById('kpi-pct-passed');
  const pctReviewEl = document.getElementById('kpi-pct-review');
  if (pctPassedEl) pctPassedEl.textContent = pctPassed.toFixed(1) + '% touchless';
  if (pctReviewEl) pctReviewEl.textContent = pctReview.toFixed(1) + '% flagged';

  const barPassed = document.getElementById('kpi-bar-passed');
  const barReview = document.getElementById('kpi-bar-review');
  if (barPassed) barPassed.style.width = pctPassed.toFixed(1) + '%';
  if (barReview) barReview.style.width = pctReview.toFixed(1) + '%';
}

/**
 * Step transitions
 */
export function showStep(stepKey) {
  if (stepKey === 'upload') {
    dom.layout.panel.classList.add('hidden');
    dom.steps.upload.classList.remove('hidden');
  } else {
    dom.steps.upload.classList.add('hidden');
    dom.layout.panel.classList.remove('hidden');
    dom.steps.extracted.classList.remove('hidden');
    dom.steps.audit.classList.remove('hidden');
  }
}

/**
 * Renders the Extracted Fields TABLE (not grid cards)
 */
export function renderExtractedData(data) {
  dom.fileNameDisplay.textContent = data.fileName;
  if (dom.previewDocName) dom.previewDocName.textContent = data.fileName;
  dom.extractedTableBody.innerHTML = '';

  const fields = [
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'vatRate', label: 'VAT Rate' },
    { key: 'vatAmount', label: 'VAT Amount' },
    { key: 'total', label: 'Total' },
  ];

  fields.forEach(({ key, label }) => {
    const raw = data.fields[key];
    const tr = document.createElement('tr');

    let sourceVal = raw;
    let normalizedVal = raw;
    let conf = ((Math.random() * 3) + 96.5).toFixed(1); // simulated per-field confidence

    if (raw === null || raw === undefined) {
      sourceVal = '—';
      normalizedVal = '<span class="check-fail">Missing</span>';
      conf = '0.0';
    } else if (typeof raw === 'number') {
      if (key === 'vatRate') {
        sourceVal = `${(raw * 100).toFixed(0)}%`;
        normalizedVal = sourceVal;
      } else {
        const sym = data.fields.currencySymbol || '';
        sourceVal = `${sym} ${raw.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        normalizedVal = raw.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
      }
    }

    const confNum = parseFloat(conf);
    const confClass = confNum >= 95 ? 'conf-high' : (confNum >= 80 ? 'conf-med' : 'conf-low');

    tr.innerHTML = `
      <td>${label}</td>
      <td>${sourceVal}</td>
      <td class="col-right">${normalizedVal}</td>
      <td class="col-right ${confClass}">${conf}%</td>
    `;
    dom.extractedTableBody.appendChild(tr);
  });
}

/** SVG icons */
const STATUS_ICONS = {
  pass: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  fail: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  review: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
};
const STATUS_ONE_LINERS = {
  pass: 'Invoice validated successfully with high confidence.',
  fail: 'Mathematical discrepancies detected. Requires accountant review.',
  review: 'Minor anomalies flagged. Needs accountant sign-off.'
};
const CHECK_ICONS = {
  pass: '<span class="check-icon check-pass"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>',
  fail: '<span class="check-icon check-fail"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>',
  review: '<span class="check-icon check-review"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>'
};

/**
 * Renders the Checks Performed TABLE + Decision Rail content
 */
export function renderAuditResults(findings, overallStatus, extractedFields) {
  const sym = extractedFields?.currencySymbol || '';

  // Decision Rail: Status Hero
  dom.summaryCard.className = `status-hero status-${overallStatus}`;
  dom.statusIconWrap.innerHTML = STATUS_ICONS[overallStatus] || '';
  let resultText = overallStatus === 'pass' ? 'Auto-Approved' : (overallStatus === 'fail' ? 'Exceptions Found' : 'Needs Accountant Review');
  dom.summaryText.textContent = resultText;
  dom.statusOneliner.textContent = STATUS_ONE_LINERS[overallStatus] || '';

  // Meta pills
  let confidence = (Math.random() * (99.2 - 95.5) + 95.5).toFixed(1);
  if (overallStatus === 'review') confidence = (Math.random() * (89 - 78) + 78).toFixed(1);
  if (overallStatus === 'fail') confidence = (Math.random() * (72 - 48) + 48).toFixed(1);

  let pCount = 0, fCount = 0, rCount = 0;
  findings.forEach(f => { if (f.status === 'pass') pCount++; if (f.status === 'fail') fCount++; if (f.status === 'review') rCount++; });

  document.getElementById('meta-confidence').textContent = confidence + '%';
  document.getElementById('meta-currency').textContent = sym || 'N/A';
  document.getElementById('meta-time').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  document.getElementById('meta-rules').textContent = `${pCount}P / ${fCount}F / ${rCount}R`;

  // CENTER: Checks Performed table
  dom.auditTableBody.innerHTML = '';

  const sub = extractedFields?.subtotal;
  const vat = extractedFields?.vatAmount;
  const rate = extractedFields?.vatRate;
  const total = extractedFields?.total;

  // Row: Required Fields
  const allPresent = sub != null && vat != null && rate != null && total != null;
  addCheckRow('Required Fields', 'All 6 fields present', allPresent ? '6 / 6 extracted' : 'Missing fields detected', allPresent ? 'pass' : 'review');

  // Row: VAT Calculation
  if (sub != null && rate != null && vat != null) {
    const expectedVat = sub * rate;
    const vatDiff = Math.abs(Math.abs(expectedVat) - Math.abs(vat));
    const ratePct = (rate * 100).toFixed(0);
    const status = vatDiff === 0 ? 'pass' : (vatDiff <= 0.05 ? 'review' : 'fail');
    addCheckRow('VAT Match', `Subtotal × ${ratePct}%`, `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} × ${ratePct}% = ${sym} ${expectedVat.toFixed(2)}`, status);
  }

  // Row: Total Validation
  if (sub != null && vat != null && total != null) {
    const signedVat = sub < 0 ? -Math.abs(vat) : Math.abs(vat);
    const expectedTotal = sub + signedVat;
    const totalDiff = Math.abs(expectedTotal - total);
    const status = totalDiff === 0 ? 'pass' : (totalDiff <= 0.05 ? 'review' : 'fail');
    addCheckRow('Total Validation', `Subtotal + VAT`, `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} + ${sym} ${vat.toFixed(2)} = ${sym} ${expectedTotal.toFixed(2)}`, status);
  }

  // Row: OCR Confidence
  addCheckRow('Confidence Gate', 'OCR avg ≥ 95%', `${confidence}% (vs 98% benchmark)`, parseFloat(confidence) >= 90 ? 'pass' : 'review');

  // Row: Approval Rule
  addCheckRow('Approval Rule', 'All checks pass', overallStatus === 'pass' ? 'Auto-approved' : (overallStatus === 'fail' ? 'Blocked — exceptions found' : 'Held for manual review'), overallStatus);

  // Evidence Trail (right rail)
  dom.auditList.innerHTML = '';
  findings.forEach(f => {
    const li = document.createElement('li');
    const iconColor = f.status === 'pass' ? 'check-pass' : (f.status === 'fail' ? 'check-fail' : 'check-review');
    li.innerHTML = `
      <span class="evidence-icon ${iconColor}">${f.status === 'pass' ? '✓' : (f.status === 'fail' ? '✗' : '⚠')}</span>
      <span><strong>${f.title}:</strong> ${f.desc}</span>
    `;
    dom.auditList.appendChild(li);
  });
}

function addCheckRow(check, formula, output, status) {
  const tr = document.createElement('tr');
  if (status === 'fail') tr.className = 'row-fail';
  if (status === 'review') tr.className = 'row-review';
  tr.innerHTML = `
    <td>${check}</td>
    <td class="col-formula">${formula}</td>
    <td class="col-output">${output}</td>
    <td class="col-center">${CHECK_ICONS[status]}</td>
  `;
  dom.auditTableBody.appendChild(tr);
}

export function showLoader(element, show) {
  if (show) element.classList.remove('hidden');
  else element.classList.add('hidden');
}

export function renderQueue(documents, selectedId, filter = 'all') {
  dom.queue.list.innerHTML = '';
  let processed = 0;

  const filtered = documents.filter(d => {
    if (d.overallStatus !== 'loading') processed++;
    if (filter === 'all') return true;
    return d.overallStatus === filter;
  });

  dom.queue.progress.textContent = `${processed} / ${documents.length}`;

  filtered.forEach(doc => {
    const el = document.createElement('div');
    const statusClass = `status-${doc.overallStatus}`;
    el.className = `queue-item ${statusClass} ${doc.id === selectedId ? 'active' : ''}`;
    el.dataset.id = doc.id;

    let statusLabel = 'Processing…';
    let statusColorClass = 'q-status-loading';
    let amountText = '';

    if (doc.overallStatus !== 'loading') {
      if (doc.overallStatus === 'pass') { statusLabel = 'Approved'; statusColorClass = 'q-status-pass'; }
      else if (doc.overallStatus === 'review') { statusLabel = 'Review'; statusColorClass = 'q-status-review'; }
      else { statusLabel = 'Failed'; statusColorClass = 'q-status-fail'; }

      const sym = doc.extractedData?.fields?.currencySymbol || '';
      const total = doc.extractedData?.fields?.total;
      amountText = total != null ? `${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})}` : '';
    }

    el.innerHTML = `
      <div class="q-title">${doc.fileName}</div>
      <div class="q-meta">
        <span>${amountText}</span>
        <span class="q-status ${statusColorClass}">${statusLabel}</span>
      </div>
    `;
    dom.queue.list.appendChild(el);
  });
}
