// src/render.js
import { ruleSets } from './ruleSets.js';

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
    demoIncorrect: document.getElementById('btn-demo-incorrect'),
    addFiles: document.getElementById('btn-add-files'),
    exportCsv: document.getElementById('btn-export-csv'),
  },
  topbarActivePolicy: document.getElementById('topbar-active-policy')
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
export function renderAuditResults(doc, overallStatus) {
  const extractedFields = doc.extractedData?.fields;
  const findings = doc.findings || [];
  const sym = extractedFields?.currencySymbol || '';
  const ruleset = ruleSets[doc.appliedRuleSetId] || { label: 'Unknown' };

  // Counts
  let pCount = 0, fCount = 0, rCount = 0;
  findings.forEach(f => { if (f.status === 'pass') pCount++; if (f.status === 'fail') fCount++; if (f.status === 'review') rCount++; });

  // ───── 1. Top Banner ─────
  dom.banner.container.className = `doc-banner status-${overallStatus}`;
  dom.banner.iconWrap.innerHTML = STATUS_ICONS[overallStatus] || '';

  let resultText = 'Approved';
  if (overallStatus === 'fail') resultText = 'Issue Detected';
  if (overallStatus === 'review') resultText = 'Needs Review';
  dom.banner.status.textContent = resultText;

  if (overallStatus === 'pass') {
    dom.banner.reason.textContent = `Policy match: all checks passed via ${ruleset.label}.`;
  } else if (overallStatus === 'fail') {
    dom.banner.reason.textContent = `${fCount} policy exception${fCount !== 1 ? 's' : ''} detected. Requires manual correction.`;
  } else {
    dom.banner.reason.textContent = `${rCount} flag${rCount !== 1 ? 's' : ''} requiring review under ${ruleset.label}.`;
  }

  const total = extractedFields?.total;
  let summaryParts = [];
  if (total != null) summaryParts.push(`Total: ${sym} ${total.toLocaleString(undefined,{minimumFractionDigits:2})}`);
  
  // Dynamic summary from findings
  if (overallStatus !== 'pass') {
    const issues = findings.filter(f => f.status === 'fail' || f.status === 'review').map(f => f.label);
    if (issues.length > 0) summaryParts.push(`Issues: ${Array.from(new Set(issues)).join(', ')}`);
  } else {
     summaryParts.push(`${ruleset.label} applied`);
  }
  
  dom.banner.summary.innerHTML = summaryParts.join(' <span class="dot">•</span> ');

  if (overallStatus === 'pass') {
    dom.banner.btnMainActionText.textContent = 'Override';
    dom.banner.btnMainAction.className = 'btn btn-secondary btn-icon';
  } else {
    dom.banner.btnMainActionText.textContent = 'Review & Fix';
    dom.banner.btnMainAction.className = 'btn btn-primary btn-icon';
  }

  // ───── 2. Proof Trail Title ─────
  dom.proof.trailTitle.innerHTML = `Ruleset: <strong>${ruleset.label}</strong> <span style="font-weight:400; opacity:0.6; margin-left:8px;">(${findings.length} checks performed)</span>`;

  // ───── 3. Proof Cards ─────
  dom.proof.timeline.innerHTML = '';
  
  findings.forEach(finding => {
      dom.proof.timeline.appendChild(
          createProofCard(finding.label, finding.formula, finding.status)
      );
  });
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

      const ruleset = ruleSets[doc.appliedRuleSetId] || { label: 'Unknown' };
      const rulesetBadge = `<span class="doc-row-ruleset">${ruleset.label}</span>`;

      el.innerHTML = `
        <span class="doc-row-dot"></span>
        <div class="doc-row-body">
          <div class="doc-row-name">${doc.fileName}${rulesetBadge}</div>
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
    const text = f.label || '';
    if (f.status === 'fail') {
      if (text.includes('VAT')) reasons.push('VAT mismatch');
      else if (text.includes('Total')) reasons.push('Total mismatch');
      else if (text.includes('Extraction') || text.includes('Error') || text.includes('System')) reasons.push('System error');
      else reasons.push(text);
    } else if (f.status === 'review') {
      if (text.includes('Confidence') || text.includes('Low')) reasons.push('Low confidence');
      else if (text.includes('VAT')) reasons.push('VAT rounding');
      else if (text.includes('Total')) reasons.push('Total rounding');
      else reasons.push(text);
    }
  });

  if (reasons.length > 0) return reasons.slice(0, 2).join(' · ');
  return `${failCount} exception${failCount !== 1 ? 's' : ''}, ${reviewCount} review`;
}
