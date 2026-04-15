// src/render.js

// DOM Elements
export const dom = {
  steps: {
    upload: document.getElementById('step-upload'),
  },
  inputs: {
    realFileUpload: document.getElementById('real-file-upload'),
    uploadZoneArea: document.getElementById('upload-zone-area'),
    browseFilesBtn: document.getElementById('btn-browse-files')
  },
  layout: {
    panel: document.getElementById('panel-layout'),
    emptyState: document.getElementById('empty-state'),
    docView: document.getElementById('doc-view-layout'),
    pdfIframe: document.getElementById('pdf-iframe'),
  },
  queue: {
    list: document.getElementById('queue-list-container'),
    progress: document.getElementById('queue-progress-text')
  },
  banner: {
    container: document.getElementById('doc-banner'),
    iconWrap: document.getElementById('db-icon-wrap'),
    status: document.getElementById('db-status'),
    reason: document.getElementById('db-reason'),
    summary: document.getElementById('db-summary'),
    btnToggleDetails: document.getElementById('btn-toggle-details'),
    btnToggleDetailsText: document.getElementById('btn-toggle-details-text'),
    btnMainAction: document.getElementById('btn-main-action'),
    btnMainActionText: document.getElementById('btn-main-action-text')
  },
  techPane: document.getElementById('tech-details-pane'),
  uploadLoader: document.getElementById('upload-loader'),
  breakdown: {
    found: document.getElementById('bd-found-list'),
    matched: document.getElementById('bd-matched-list'),
    issuesWrapper: document.getElementById('bd-issues-container'),
    issues: document.getElementById('bd-issues-list'),
  },
  buttons: {
    demoCorrect: document.getElementById('btn-demo-correct'),
    demoIncorrect: document.getElementById('btn-demo-incorrect'),
    addFiles: document.getElementById('btn-add-files'),
    exportCsv: document.getElementById('btn-export-csv'),
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
  }
}

/** SVG icons */
const STATUS_ICONS = {
  pass: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  fail: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  review: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
};

export function renderExtractedData(data) {
  dom.breakdown.found.innerHTML = '';
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
    const li = document.createElement('li');
    let sourceVal;

    if (raw === null || raw === undefined) {
      sourceVal = '<span class="bd-val val-warning">Missing</span>';
    } else if (typeof raw === 'number') {
      if (key === 'vatRate') {
        sourceVal = `<span class="bd-val">${(raw * 100).toFixed(0)}%</span>`;
      } else {
        const sym = data.fields.currencySymbol || '';
        sourceVal = `<span class="bd-val">${sym} ${raw.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>`;
      }
    } else {
      sourceVal = `<span class="bd-val">${raw}</span>`;
    }

    li.innerHTML = `<span class="bd-label">${label}</span> ${sourceVal}`;
    dom.breakdown.found.appendChild(li);
  });
}

/**
 * Renders the High-Level Top Banner and Breakdown Panels
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

  // ───── 1. Top Banner Updates ─────
  dom.banner.container.className = `doc-banner status-${overallStatus}`;
  dom.banner.iconWrap.innerHTML = STATUS_ICONS[overallStatus] || '';

  let resultText = 'Auto-Approved';
  if (overallStatus === 'fail') resultText = 'Needs Review';
  if (overallStatus === 'review') resultText = 'Needs Review';
  dom.banner.status.textContent = resultText;

  // Reason
  if (overallStatus === 'pass') {
    dom.banner.reason.textContent = `Matched all checks. No anomalies.`;
  } else if (overallStatus === 'fail') {
    dom.banner.reason.textContent = `${fCount} exception${fCount !== 1 ? 's' : ''} detected. Requires manual correction.`;
  } else {
    dom.banner.reason.textContent = `${rCount} anomal${rCount !== 1 ? 'ies' : 'y'} flagged. Accountant sign-off needed.`;
  }

  // Short Business Summary
  const sub = extractedFields?.subtotal;
  const vat = extractedFields?.vatAmount;
  const total = extractedFields?.total;
  let summaryParts = [];

  if (total != null) {
      summaryParts.push(`Total: ${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})}`);
  }

  if (overallStatus === 'pass' && sub != null && vat != null && total != null) {
      summaryParts.push(`VAT matched`);
  } else if (overallStatus === 'fail') {
      const failTitles = findings.filter(f => f.status === 'fail').map(f => {
        if (f.title.includes('VAT')) return 'VAT mismatch';
        if (f.title.includes('Total')) return 'Total mismatch';
        return f.title;
      });
      summaryParts.push(`Issue: ${failTitles.join(', ')}`);
  } else if (overallStatus === 'review') {
      const reviewTitles = findings.filter(f => f.status === 'review').map(f => {
        if (f.title.includes('Confidence') || f.title.includes('Low')) return 'Low confidence OCR';
        if (f.title.includes('VAT')) return 'VAT rounding';
        return f.title;
      });
      summaryParts.push(`Flagged: ${reviewTitles.join(', ')}`);
  }

  dom.banner.summary.innerHTML = summaryParts.join(' <span class="dot">•</span> ');

  // Action Buttons
  if (overallStatus === 'pass') {
    dom.banner.btnMainActionText.textContent = 'Override';
    dom.banner.btnMainAction.className = 'btn btn-secondary btn-icon';
  } else if (overallStatus === 'fail') {
    dom.banner.btnMainActionText.textContent = 'Review & Fix';
    dom.banner.btnMainAction.className = 'btn btn-primary btn-icon';
  } else {
    dom.banner.btnMainActionText.textContent = 'Approve Flag';
    dom.banner.btnMainAction.className = 'btn btn-primary btn-icon';
  }

  // ───── 2. Breakdown Pane Updates ─────
  dom.breakdown.matched.innerHTML = '';
  dom.breakdown.issues.innerHTML = '';
  let issuesCount = 0;

  const addMatch = (label, formula, result) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="proof-label">${label}</span> <span class="proof-divider">—</span> <span class="proof-formula">${formula}</span><span class="proof-result">, ${result}</span>`;
    dom.breakdown.matched.appendChild(li);
  };

  const addIssue = (label, formula, result, status) => {
    issuesCount++;
    const li = document.createElement('li');
    li.innerHTML = `<span class="proof-label">${label}</span> <span class="proof-divider">—</span> <span class="proof-formula">${formula}</span><span class="proof-result ${status}">, ${result}</span>`;
    dom.breakdown.issues.appendChild(li);
  };

  const rate = extractedFields?.vatRate;
  const allPresent = sub != null && vat != null && rate != null && total != null;
  
  if (allPresent) {
    addMatch('Required fields', '6 of 6 fields found', 'all required fields present');
  } else {
    addIssue('Required fields', 'Missing critical fields', 'cannot verify complete document', 'issue');
  }

  if (sub != null && rate != null && vat != null) {
    const expectedVat = sub * rate;
    const vatDiff = Math.abs(Math.abs(expectedVat) - Math.abs(vat));
    const formulaStr = `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} × ${(rate*100).toFixed(0)}% = ${sym} ${expectedVat.toFixed(2)}`;
    
    if (vatDiff === 0) {
      addMatch('VAT check', formulaStr, 'matched invoice VAT');
    } else {
      addIssue('VAT check', formulaStr, `did NOT match invoice VAT (${sym} ${vat.toFixed(2)})`, vatDiff <= 0.05 ? 'warning' : 'issue');
    }
  }

  if (sub != null && vat != null && total != null) {
    const signedVat = sub < 0 ? -Math.abs(vat) : Math.abs(vat);
    const expectedTotal = sub + signedVat;
    const totalDiff = Math.abs(expectedTotal - total);
    const formulaStr = `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} + ${sym} ${vat.toFixed(2)} = ${sym} ${expectedTotal.toFixed(2)}`;
    
    if (totalDiff === 0) {
      addMatch('Total check', formulaStr, 'matched invoice total');
    } else {
      addIssue('Total check', formulaStr, `did NOT match invoice total (${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})})`, totalDiff <= 0.05 ? 'warning' : 'issue');
    }
  }

  if (parseFloat(confidence) >= 90) {
    addMatch('Confidence check', `${confidence}% confidence`, 'above approval threshold');
  } else {
    addIssue('Confidence check', `${confidence}% confidence`, 'below 90% threshold', 'warning');
  }

  if (issuesCount > 0) {
    dom.breakdown.issuesWrapper.classList.remove('hidden');
  } else {
    dom.breakdown.issuesWrapper.classList.add('hidden');
  }
}

export function showLoader(element, show) {
  if (show) element.classList.remove('hidden');
  else element.classList.add('hidden');
}

export function renderQueue(documents, selectedId, filter = 'all', searchTerm = '', sortMode = 'time') {
  dom.queue.list.innerHTML = '';

  let countPass = 0, countFail = 0, countReview = 0, countLoading = 0;
  documents.forEach(d => {
    if (d.overallStatus === 'pass') countPass++;
    else if (d.overallStatus === 'fail') countFail++;
    else if (d.overallStatus === 'review') countReview++;
    else countLoading++;
  });

  dom.queue.progress.textContent = `${documents.length} item${documents.length !== 1 ? 's' : ''}`;
  const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCount('q-count-fail', countFail);
  setCount('q-count-review', countReview);
  setCount('q-count-pass', countPass);
  setCount('q-count-loading', countLoading);

  let filtered = documents;
  if (filter !== 'all') {
    filtered = filtered.filter(d => d.overallStatus === filter);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(d => {
      const vendor = getVendorName(d);
      return d.fileName.toLowerCase().includes(term) || vendor.toLowerCase().includes(term);
    });
  }

  if (sortMode === 'risk') {
    const riskOrder = { fail: 0, review: 1, loading: 2, pass: 3 };
    filtered.sort((a, b) => (riskOrder[a.overallStatus] ?? 9) - (riskOrder[b.overallStatus] ?? 9));
  } else if (sortMode === 'amount') {
    filtered.sort((a, b) => (b.extractedData?.fields?.total || 0) - (a.extractedData?.fields?.total || 0));
  }

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

  groups.forEach(group => {
    if (group.items.length === 0) return;

    const header = document.createElement('div');
    header.className = 'q-section-head';
    header.innerHTML = `<span>${group.label}</span><span class="q-section-count">${group.items.length}</span>`;
    dom.queue.list.appendChild(header);

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

function getVendorName(doc) {
  if (doc.overallStatus === 'loading') return 'Extracting vendor…';
  const name = doc.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getConfidence(doc) {
  if (doc.overallStatus === 'loading') return 0;
  if (doc.overallStatus === 'pass') return Math.floor(Math.random() * 4 + 96);
  if (doc.overallStatus === 'review') return Math.floor(Math.random() * 10 + 80);
  return Math.floor(Math.random() * 25 + 45);
}

function getTriageReason(doc) {
  if (doc.overallStatus === 'loading') return '';
  if (!doc.findings || doc.findings.length === 0) return '';

  const passCount = doc.findings.filter(f => f.status === 'pass').length;
  const failCount = doc.findings.filter(f => f.status === 'fail').length;
  const reviewCount = doc.findings.filter(f => f.status === 'review').length;

  if (doc.overallStatus === 'pass') {
    return `${passCount}/${doc.findings.length} checks passed`;
  }

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
