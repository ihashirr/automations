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
 * Renders the Decision Console (right rail) + Checks Performed table (center)
 */
export function renderAuditResults(findings, overallStatus, extractedFields) {
  const sym = extractedFields?.currencySymbol || '';

  // Confidence calc
  let confidence = (Math.random() * (99.2 - 95.5) + 95.5).toFixed(1);
  if (overallStatus === 'review') confidence = (Math.random() * (89 - 78) + 78).toFixed(1);
  if (overallStatus === 'fail') confidence = (Math.random() * (72 - 48) + 48).toFixed(1);

  // Counts
  let pCount = 0, fCount = 0, rCount = 0;
  findings.forEach(f => { if (f.status === 'pass') pCount++; if (f.status === 'fail') fCount++; if (f.status === 'review') rCount++; });
  const totalChecks = findings.length;

  // ───── Decision Summary Card ─────
  dom.summaryCard.className = `decision-card status-${overallStatus}`;
  dom.statusIconWrap.innerHTML = STATUS_ICONS[overallStatus] || '';

  // Title
  let resultText = 'Auto-Approved';
  if (overallStatus === 'fail') resultText = 'Exceptions Found';
  if (overallStatus === 'review') resultText = 'Needs Accountant Review';
  dom.summaryText.textContent = resultText;

  // Risk label
  const riskEl = document.getElementById('dc-risk-label');
  if (riskEl) {
    if (overallStatus === 'pass') {
      riskEl.textContent = 'Low risk';
      riskEl.className = 'dc-risk-label dc-risk-low';
    } else if (overallStatus === 'review') {
      riskEl.textContent = 'Medium risk';
      riskEl.className = 'dc-risk-label dc-risk-med';
    } else {
      riskEl.textContent = 'High risk';
      riskEl.className = 'dc-risk-label dc-risk-high';
    }
  }

  // Reason
  const reasonEl = document.getElementById('dc-reason');
  if (reasonEl) {
    if (overallStatus === 'pass') {
      reasonEl.textContent = `${pCount}/${totalChecks} validation checks passed. No exceptions detected.`;
    } else if (overallStatus === 'fail') {
      reasonEl.textContent = `${fCount} exception${fCount !== 1 ? 's' : ''} detected. Manual review required before approval.`;
    } else {
      reasonEl.textContent = `${rCount} anomal${rCount !== 1 ? 'ies' : 'y'} flagged. Accountant sign-off needed.`;
    }
  }

  // Proof
  const proofEl = document.getElementById('dc-proof');
  if (proofEl) {
    const sub = extractedFields?.subtotal;
    const vat = extractedFields?.vatAmount;
    const total = extractedFields?.total;
    if (overallStatus === 'pass' && sub != null && vat != null && total != null) {
      proofEl.textContent = `Key proof: VAT and total matched exactly (${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})})`;
    } else if (overallStatus === 'fail') {
      const failTitles = findings.filter(f => f.status === 'fail').map(f => {
        if (f.title.includes('VAT')) return 'VAT mismatch';
        if (f.title.includes('Total')) return 'Total mismatch';
        return f.title;
      });
      proofEl.textContent = `Key issue: ${failTitles.join(', ')}`;
    } else {
      const reviewTitles = findings.filter(f => f.status === 'review').map(f => {
        if (f.title.includes('Confidence') || f.title.includes('Low')) return 'Low confidence extraction';
        if (f.title.includes('VAT')) return 'VAT rounding difference';
        return f.title;
      });
      proofEl.textContent = `Flagged: ${reviewTitles.join(', ')}`;
    }
  }

  // ───── Metrics Grid ─────
  const setMetric = (id, val, cls) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = val;
      el.className = 'metric-val' + (cls ? ` ${cls}` : '');
    }
  };

  setMetric('meta-confidence', confidence + '%', parseFloat(confidence) >= 90 ? 'metric-val-pass' : 'metric-val-review');
  setMetric('meta-currency', sym || 'N/A');
  setMetric('meta-time', new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
  setMetric('meta-rules', `${pCount}/${totalChecks}`, pCount === totalChecks ? 'metric-val-pass' : '');
  setMetric('meta-exceptions', fCount === 0 ? '0' : String(fCount), fCount === 0 ? 'metric-val-pass' : 'metric-val-fail');
  setMetric('meta-review-needed', overallStatus === 'pass' ? 'No' : 'Yes', overallStatus === 'pass' ? 'metric-val-pass' : 'metric-val-review');

  // ───── CENTER: Checks Performed table ─────
  dom.auditTableBody.innerHTML = '';

  const sub = extractedFields?.subtotal;
  const vat = extractedFields?.vatAmount;
  const rate = extractedFields?.vatRate;
  const total = extractedFields?.total;

  const allPresent = sub != null && vat != null && rate != null && total != null;
  addCheckRow('Required Fields', 'All 6 fields present', allPresent ? '6 / 6 extracted' : 'Missing fields detected', allPresent ? 'pass' : 'review');

  if (sub != null && rate != null && vat != null) {
    const expectedVat = sub * rate;
    const vatDiff = Math.abs(Math.abs(expectedVat) - Math.abs(vat));
    const ratePct = (rate * 100).toFixed(0);
    const status = vatDiff === 0 ? 'pass' : (vatDiff <= 0.05 ? 'review' : 'fail');
    addCheckRow('VAT Match', `Subtotal × ${ratePct}%`, `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} × ${ratePct}% = ${sym} ${expectedVat.toFixed(2)}`, status);
  }

  if (sub != null && vat != null && total != null) {
    const signedVat = sub < 0 ? -Math.abs(vat) : Math.abs(vat);
    const expectedTotal = sub + signedVat;
    const totalDiff = Math.abs(expectedTotal - total);
    const status = totalDiff === 0 ? 'pass' : (totalDiff <= 0.05 ? 'review' : 'fail');
    addCheckRow('Total Validation', `Subtotal + VAT`, `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} + ${sym} ${vat.toFixed(2)} = ${sym} ${expectedTotal.toFixed(2)}`, status);
  }

  addCheckRow('Confidence Gate', 'OCR avg ≥ 95%', `${confidence}% (vs 98% benchmark)`, parseFloat(confidence) >= 90 ? 'pass' : 'review');
  addCheckRow('Approval Rule', 'All checks pass', overallStatus === 'pass' ? 'Auto-approved' : (overallStatus === 'fail' ? 'Blocked — exceptions found' : 'Held for manual review'), overallStatus);

  // ───── Evidence Checklist (right rail) ─────
  dom.auditList.innerHTML = '';

  // Compact checklist items  
  const checklistItems = buildChecklist(findings, extractedFields, sym, confidence);
  checklistItems.forEach(item => {
    const li = document.createElement('li');
    const colorClass = item.status === 'pass' ? 'ec-pass' : (item.status === 'fail' ? 'ec-fail' : 'ec-review');
    const icon = item.status === 'pass' ? '✓' : (item.status === 'fail' ? '✗' : '⚠');
    li.innerHTML = `
      <span class="ec-label">${item.label}</span>
      <span class="ec-value ${colorClass}">${item.value} ${icon}</span>
    `;
    dom.auditList.appendChild(li);
  });
}

/**
 * Builds a compact evidence checklist
 */
function buildChecklist(findings, fields, sym, confidence) {
  const items = [];
  
  items.push({
    label: 'Required fields',
    value: fields?.invoiceNumber ? 'Present' : 'Missing',
    status: fields?.invoiceNumber ? 'pass' : 'review'
  });

  if (fields?.subtotal != null && fields?.vatRate != null && fields?.vatAmount != null) {
    const expected = fields.subtotal * fields.vatRate;
    const diff = Math.abs(Math.abs(expected) - Math.abs(fields.vatAmount));
    items.push({
      label: 'VAT match',
      value: diff === 0 ? `${sym} ${fields.vatAmount.toFixed(2)}` : `Off by ${sym} ${diff.toFixed(2)}`,
      status: diff === 0 ? 'pass' : (diff <= 0.05 ? 'review' : 'fail')
    });
  }

  if (fields?.subtotal != null && fields?.vatAmount != null && fields?.total != null) {
    const signedVat = fields.subtotal < 0 ? -Math.abs(fields.vatAmount) : Math.abs(fields.vatAmount);
    const expected = fields.subtotal + signedVat;
    const diff = Math.abs(expected - fields.total);
    items.push({
      label: 'Total match',
      value: diff === 0 ? `${sym} ${fields.total.toLocaleString(undefined,{minimumFractionDigits:2})}` : `Off by ${sym} ${diff.toFixed(2)}`,
      status: diff === 0 ? 'pass' : (diff <= 0.05 ? 'review' : 'fail')
    });
  }

  items.push({
    label: 'Confidence',
    value: confidence + '%',
    status: parseFloat(confidence) >= 90 ? 'pass' : 'review'
  });

  return items;
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

export function renderQueue(documents, selectedId, filter = 'all', searchTerm = '', sortMode = 'time') {
  dom.queue.list.innerHTML = '';

  // Count all statuses (unfiltered)
  let countPass = 0, countFail = 0, countReview = 0, countLoading = 0;
  documents.forEach(d => {
    if (d.overallStatus === 'pass') countPass++;
    else if (d.overallStatus === 'fail') countFail++;
    else if (d.overallStatus === 'review') countReview++;
    else countLoading++;
  });

  // Update summary stats
  dom.queue.progress.textContent = `${documents.length} item${documents.length !== 1 ? 's' : ''}`;
  const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCount('q-count-fail', countFail);
  setCount('q-count-review', countReview);
  setCount('q-count-pass', countPass);
  setCount('q-count-loading', countLoading);

  // Filter
  let filtered = documents;
  if (filter !== 'all') {
    filtered = filtered.filter(d => d.overallStatus === filter);
  }

  // Search
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(d => {
      const vendor = getVendorName(d);
      return d.fileName.toLowerCase().includes(term) || vendor.toLowerCase().includes(term);
    });
  }

  // Sort
  if (sortMode === 'risk') {
    const riskOrder = { fail: 0, review: 1, loading: 2, pass: 3 };
    filtered.sort((a, b) => (riskOrder[a.overallStatus] ?? 9) - (riskOrder[b.overallStatus] ?? 9));
  } else if (sortMode === 'amount') {
    filtered.sort((a, b) => (b.extractedData?.fields?.total || 0) - (a.extractedData?.fields?.total || 0));
  }
  // 'time' = original order, no sort needed

  // Group by status
  const groups = [
    { key: 'fail', label: 'Exceptions', items: [] },
    { key: 'review', label: 'Needs Review', items: [] },
    { key: 'loading', label: 'Processing', items: [] },
    { key: 'pass', label: 'Auto-Approved', items: [] },
  ];

  filtered.forEach(doc => {
    const g = groups.find(g => g.key === doc.overallStatus);
    if (g) g.items.push(doc);
  });

  // Render grouped
  groups.forEach(group => {
    if (group.items.length === 0) return;

    // Section header
    const header = document.createElement('div');
    header.className = 'q-section-head';
    header.innerHTML = `<span>${group.label}</span><span class="q-section-count">${group.items.length}</span>`;
    dom.queue.list.appendChild(header);

    // Rows
    group.items.forEach(doc => {
      const el = document.createElement('div');
      el.className = `queue-item status-${doc.overallStatus} ${doc.id === selectedId ? 'active' : ''}`;
      el.dataset.id = doc.id;

      const vendor = getVendorName(doc);
      const conf = getConfidence(doc);
      const confClass = conf >= 95 ? 'q-conf-high' : (conf >= 80 ? 'q-conf-med' : 'q-conf-low');
      const reason = getTriageReason(doc);
      const sym = doc.extractedData?.fields?.currencySymbol || '';
      const total = doc.extractedData?.fields?.total;
      const amountText = total != null ? `${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})}` : '';

      let badgeLabel, badgeClass;
      if (doc.overallStatus === 'pass') { badgeLabel = 'Approved'; badgeClass = 'q-badge-pass'; }
      else if (doc.overallStatus === 'review') { badgeLabel = 'Review'; badgeClass = 'q-badge-review'; }
      else if (doc.overallStatus === 'fail') { badgeLabel = 'Exception'; badgeClass = 'q-badge-fail'; }
      else { badgeLabel = 'Processing'; badgeClass = 'q-badge-loading'; }

      el.innerHTML = `
        <div class="q-row-top">
          <span class="q-title">${doc.fileName}</span>
          ${doc.overallStatus !== 'loading' ? `<span class="q-confidence ${confClass}">${conf}%</span>` : ''}
        </div>
        <div class="q-vendor">${vendor}</div>
        <div class="q-row-bottom">
          <span class="q-amount">${amountText}</span>
          <span class="q-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        ${reason ? `<div class="q-reason">${reason}</div>` : ''}
      `;

      dom.queue.list.appendChild(el);
    });
  });
}

/**
 * Extracts a simulated vendor name from filename
 */
function getVendorName(doc) {
  if (doc.overallStatus === 'loading') return 'Extracting vendor…';
  // Try to derive from filename
  const name = doc.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
  // Capitalize first letter of each word
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Simulated per-document confidence
 */
function getConfidence(doc) {
  if (doc.overallStatus === 'loading') return 0;
  if (doc.overallStatus === 'pass') return Math.floor(Math.random() * 4 + 96); // 96-99
  if (doc.overallStatus === 'review') return Math.floor(Math.random() * 10 + 80); // 80-89
  return Math.floor(Math.random() * 25 + 45); // 45-69
}

/**
 * Generate a human-readable triage reason from findings
 */
function getTriageReason(doc) {
  if (doc.overallStatus === 'loading') return '';
  if (!doc.findings || doc.findings.length === 0) return '';

  const passCount = doc.findings.filter(f => f.status === 'pass').length;
  const failCount = doc.findings.filter(f => f.status === 'fail').length;
  const reviewCount = doc.findings.filter(f => f.status === 'review').length;

  if (doc.overallStatus === 'pass') {
    return `${passCount}/${doc.findings.length} checks passed`;
  }

  // Build specific reason
  const reasons = [];
  doc.findings.forEach(f => {
    if (f.status === 'fail') {
      if (f.title.includes('VAT')) reasons.push('VAT mismatch');
      else if (f.title.includes('Total')) reasons.push('Total mismatch');
      else if (f.title.includes('Extraction') || f.title.includes('Error')) reasons.push('Extraction error');
      else reasons.push(f.title);
    } else if (f.status === 'review') {
      if (f.title.includes('Confidence') || f.title.includes('Low')) reasons.push('Low OCR confidence');
      else if (f.title.includes('VAT')) reasons.push('VAT rounding');
      else if (f.title.includes('Total')) reasons.push('Total rounding');
      else reasons.push(f.title);
    }
  });

  if (reasons.length > 0) return reasons.slice(0, 2).join(' · ');
  return `${failCount} exception${failCount !== 1 ? 's' : ''}, ${reviewCount} review`;
}

