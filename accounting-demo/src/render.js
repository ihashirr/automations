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
  uploadLoader: document.getElementById('upload-loader'),
  statusText: document.getElementById('extraction-status-text'),
  extractedGrid: document.getElementById('extracted-fields-container'),
  fileNameDisplay: document.getElementById('display-file-name'),
  auditLoading: document.getElementById('audit-loading'),
  auditResultsContainer: document.getElementById('audit-results-container'),
  auditList: document.getElementById('audit-list-container'),
  summaryCard: document.getElementById('final-summary-card'),
  summaryText: document.getElementById('automation-result-text'),
  buttons: {
    demoCorrect: document.getElementById('btn-demo-correct'),
    demoIncorrect: document.getElementById('btn-demo-incorrect'),
    reUpload: document.getElementById('btn-re-upload'),
    runAudit: document.getElementById('btn-run-audit'),
    finish: document.getElementById('btn-finish')
  }
};

/**
 * Transitions between main steps
 */
export function showStep(stepKey) {
  Object.values(dom.steps).forEach(el => el.classList.add('hidden'));
  if (stepKey === 'upload') {
    dom.layout.panel.classList.add('hidden');
    dom.steps.upload.classList.remove('hidden');
  } else {
    // When showing extracted/audit, show the panel layout
    dom.steps.upload.classList.add('hidden');
    dom.layout.panel.classList.remove('hidden');
    
    // Within the panel, ensure only the active inner step is shown
    if (stepKey === 'extracted') {
       dom.steps.extracted.classList.remove('hidden');
       dom.steps.audit.classList.add('hidden');
    } else if (stepKey === 'audit') {
       dom.steps.extracted.classList.add('hidden');
       dom.steps.audit.classList.remove('hidden');
    }
  }
}

/**
 * Renders the extracted fields grid
 */
export function renderExtractedData(data) {
  dom.fileNameDisplay.textContent = data.fileName;
  dom.extractedGrid.innerHTML = '';

  const labels = {
    invoiceNumber: "Invoice Number",
    invoiceDate: "Invoice Date",
    subtotal: "Subtotal",
    vatRate: "VAT Rate",
    vatAmount: "VAT Amount",
    total: "Total"
  };

  Object.keys(labels).forEach(key => {
    const val = data.fields[key];
    const item = document.createElement('div');
    item.className = 'field-item';
    
    let displayVal = val;
    if (val === null || val === undefined) {
      displayVal = '<span class="missing">Missing</span>';
    } else if (typeof val === 'number') {
      // route currency matching based on extracted symbol
      if (key !== 'vatRate') {
        const sym = data.fields.currencySymbol || '';
        displayVal = `${sym} ${val.toFixed(2)}`.trim();
      } else {
        displayVal = `${(val * 100).toFixed(0)}%`;
      }
    }

    item.innerHTML = `
      <span class="field-label">${labels[key]}</span>
      <span class="field-val">${displayVal}</span>
    `;
    dom.extractedGrid.appendChild(item);
  });
}

/**
 * Renders the audit results and summary card
 */
export function renderAuditResults(findings, overallStatus) {
  dom.auditList.innerHTML = '';
  
  findings.forEach(f => {
    const li = document.createElement('li');
    li.className = 'audit-item';
    
    li.innerHTML = `
      <div class="audit-details">
        <div class="audit-title">${f.title} <span class="status-badge badge-${f.status}">${f.status.toUpperCase()}</span></div>
        <div class="audit-desc">${f.desc}</div>
      </div>
    `;
    dom.auditList.appendChild(li);
  });

  // Render Summary Card
  dom.summaryCard.className = `summary-box summary-${overallStatus}`;
  let resultText = '';
  if (overallStatus === 'pass') resultText = 'Automation result: Passed';
  if (overallStatus === 'fail') resultText = 'Automation result: Failed';
  if (overallStatus === 'review') resultText = 'Automation result: Needs human review';
  
  dom.summaryText.textContent = resultText;
}

export function showLoader(element, show) {
  if (show) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}
