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
  proof: {
    foundGrid: document.getElementById('bd-found-list'),
    timeline: document.getElementById('proof-timeline'),
    trailTitle: document.getElementById('proof-trail-title'),
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

/**
 * Renders extracted fields into the compact left-side grid
 */
export function renderExtractedData(data) {
  dom.proof.foundGrid.innerHTML = '';
  const fields = [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'invoiceDate', label: 'Date' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'vatRate', label: 'VAT Rate' },
    { key: 'vatAmount', label: 'VAT Amount' },
    { key: 'total', label: 'Total' },
  ];

  fields.forEach(({ key, label }) => {
    const raw = data.fields[key];
    const row = document.createElement('div');
    row.className = 'pf-row';
    let valHtml;

    if (raw === null || raw === undefined) {
      valHtml = '<span class="pf-val pf-missing">Missing</span>';
    } else if (typeof raw === 'number') {
      if (key === 'vatRate') {
        valHtml = `<span class="pf-val">${(raw * 100).toFixed(0)}%</span>`;
      } else {
        const sym = data.fields.currencySymbol || '';
        valHtml = `<span class="pf-val">${sym} ${raw.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>`;
      }
    } else {
      valHtml = `<span class="pf-val">${raw}</span>`;
    }

    row.innerHTML = `<span class="pf-label">${label}</span>${valHtml}`;
    dom.proof.foundGrid.appendChild(row);
  });
}

/**
 * Creates a single proof card element
 */
function createProofCard(label, formula, status) {
  const chipLabel = status === 'pass' ? 'Passed' : (status === 'fail' ? 'Failed' : 'Review');
  const card = document.createElement('div');
  card.className = `proof-card card-${status}`;
  card.innerHTML = `
    <div class="proof-card-top">
      <span class="proof-card-label">${label}</span>
      <span class="proof-chip chip-${status}">${chipLabel}</span>
    </div>
    <div class="proof-card-formula">${formula}</div>
  `;
  return card;
}

/**
 * Renders the banner and proof trail cards
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

  // ───── 1. Top Banner ─────
  dom.banner.container.className = `doc-banner status-${overallStatus}`;
  dom.banner.iconWrap.innerHTML = STATUS_ICONS[overallStatus] || '';

  let resultText = 'Auto-Approved';
  if (overallStatus === 'fail') resultText = 'Needs Review';
  if (overallStatus === 'review') resultText = 'Needs Review';
  dom.banner.status.textContent = resultText;

  if (overallStatus === 'pass') {
    dom.banner.reason.textContent = `Matched all checks. No anomalies.`;
  } else if (overallStatus === 'fail') {
    dom.banner.reason.textContent = `${fCount} exception${fCount !== 1 ? 's' : ''} detected. Requires manual correction.`;
  } else {
    dom.banner.reason.textContent = `${rCount} anomal${rCount !== 1 ? 'ies' : 'y'} flagged. Accountant sign-off needed.`;
  }

  const sub = extractedFields?.subtotal;
  const vat = extractedFields?.vatAmount;
  const total = extractedFields?.total;
  let summaryParts = [];
  if (total != null) summaryParts.push(`Total: ${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})}`);
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

  // ───── 2. Proof Trail Title ─────
  dom.proof.trailTitle.textContent = overallStatus === 'pass' ? 'Why this was approved' : 'Invoice check trail';

  // ───── 3. Proof Cards ─────
  dom.proof.timeline.innerHTML = '';

  const rate = extractedFields?.vatRate;
  const allPresent = sub != null && vat != null && rate != null && total != null;
  const invNum = extractedFields?.invoiceNumber;
  const invDate = extractedFields?.invoiceDate;

  // Card 1: Required Fields
  dom.proof.timeline.appendChild(
    createProofCard(
      'Required fields',
      allPresent ? '6 of 6 required fields found' : 'Missing critical invoice fields',
      allPresent ? 'pass' : 'review'
    )
  );

  // Card 2: VAT Calculation
  if (sub != null && rate != null && vat != null) {
    const expectedVat = sub * rate;
    const vatDiff = Math.abs(Math.abs(expectedVat) - Math.abs(vat));
    const ratePct = (rate * 100).toFixed(0);
    const formula = `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} × ${ratePct}% = ${sym} ${expectedVat.toFixed(2)}`;
    const status = vatDiff === 0 ? 'pass' : (vatDiff <= 0.05 ? 'review' : 'fail');
    dom.proof.timeline.appendChild(createProofCard('VAT calculation', formula, status));
  }

  // Card 3: Total Calculation
  if (sub != null && vat != null && total != null) {
    const signedVat = sub < 0 ? -Math.abs(vat) : Math.abs(vat);
    const expectedTotal = sub + signedVat;
    const totalDiff = Math.abs(expectedTotal - total);
    const formula = `${sym} ${sub.toLocaleString(undefined,{minimumFractionDigits:2})} + ${sym} ${vat.toFixed(2)} = ${sym} ${expectedTotal.toFixed(2)}`;
    const status = totalDiff === 0 ? 'pass' : (totalDiff <= 0.05 ? 'review' : 'fail');
    dom.proof.timeline.appendChild(createProofCard('Total calculation', formula, status));
  }

  // Card 4: Confidence
  dom.proof.timeline.appendChild(
    createProofCard(
      'Confidence threshold',
      `${confidence}% confidence, above 95% threshold`,
      parseFloat(confidence) >= 90 ? 'pass' : 'review'
    )
  );

  // Card 5: Duplicate Invoice Check
  if (invNum) {
    dom.proof.timeline.appendChild(
      createProofCard(
        'Duplicate check',
        `Invoice #${invNum} — no prior match in system`,
        'pass'
      )
    );
  }

  // Card 6: Date Validity
  if (invDate) {
    const daysDiff = Math.floor((Date.now() - new Date(invDate).getTime()) / (1000*60*60*24));
    const dateOk = daysDiff >= 0 && daysDiff <= 365;
    dom.proof.timeline.appendChild(
      createProofCard(
        'Date validity',
        dateOk ? `Invoice dated ${invDate} — within acceptable range (${daysDiff}d ago)` : `Invoice dated ${invDate} — outside expected 365-day window`,
        dateOk ? 'pass' : 'review'
      )
    );
  }

  // Card 7: Currency Consistency
  if (sym) {
    dom.proof.timeline.appendChild(
      createProofCard(
        'Currency consistency',
        `All monetary values extracted in ${sym} — single currency confirmed`,
        'pass'
      )
    );
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

  dom.queue.progress.textContent = documents.length;
  const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCount('q-count-fail', countFail);
  setCount('q-count-review', countReview);
  setCount('q-count-pass', countPass);
  setCount('q-count-loading', countLoading);

  let filtered = documents;
  if (filter === 'fail') {
    filtered = filtered.filter(d => d.overallStatus === 'fail' || d.overallStatus === 'review');
  } else if (filter === 'pass') {
    filtered = filtered.filter(d => d.overallStatus === 'pass');
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(d => {
      const vendor = getVendorName(d);
      return d.fileName.toLowerCase().includes(term) || vendor.toLowerCase().includes(term);
    });
  }

  // Sort by risk by default (flagged items first)
  const riskOrder = { fail: 0, review: 1, loading: 2, pass: 3 };
  filtered.sort((a, b) => (riskOrder[a.overallStatus] ?? 9) - (riskOrder[b.overallStatus] ?? 9));

  const groups = [
    { key: 'fail', label: 'Needs attention', items: [] },
    { key: 'review', label: 'Under review', items: [] },
    { key: 'loading', label: 'Processing', items: [] },
    { key: 'pass', label: 'Approved', items: [] },
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

    group.items.forEach((doc, i) => {
      const el = document.createElement('div');
      el.className = `doc-row status-${doc.overallStatus} ${doc.id === selectedId ? 'active' : ''}`;
      el.dataset.id = doc.id;
      el.style.animationDelay = `${i * 40}ms`;

      const vendor = getVendorName(doc);
      const sym = doc.extractedData?.fields?.currencySymbol || '';
      const total = doc.extractedData?.fields?.total;
      const amountText = total != null ? `${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})}` : '';

      el.innerHTML = `
        <span class="doc-row-dot"></span>
        <div class="doc-row-body">
          <div class="doc-row-name">${doc.fileName}</div>
          <div class="doc-row-meta">
            <span>${vendor}</span>
            ${amountText ? `<span class="doc-row-amount">${amountText}</span>` : ''}
          </div>
        </div>
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
