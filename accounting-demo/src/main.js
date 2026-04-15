// src/main.js
import './style.css';
import { simulateExtraction, extractFromPdf } from './extraction.js';
import { runAuditChecks, getOverallStatus } from './validation.js';
import { dom, showStep, renderExtractedData, renderAuditResults, showLoader, updateKPIs, renderQueue } from './render.js';

let documentsQueue = [];
let selectedDocId = null;
let currentFilter = 'all';
let searchTerm = '';
let sortMode = 'time';
let detailsPaneOpen = false;
let showOnlyExceptions = false;

// Simulated historical data
let globalMetrics = {
  processed: 1420,
  passed: 1305,
  review: 115,
  timeSavedHours: 42.5
};

function bindEvents() {
  // Browse Files
  dom.inputs.browseFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.inputs.realFileUpload.click();
  });
  dom.inputs.uploadZoneArea.addEventListener('click', (e) => {
    if (e.target === dom.inputs.realFileUpload || e.target.closest('.btn')) return;
    dom.inputs.realFileUpload.click();
  });

  dom.inputs.realFileUpload.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  });

  // Drag and drop
  dom.inputs.uploadZoneArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.inputs.uploadZoneArea.classList.add('dragover');
  });
  dom.inputs.uploadZoneArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dom.inputs.uploadZoneArea.classList.remove('dragover');
  });
  dom.inputs.uploadZoneArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.inputs.uploadZoneArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf"));
    }
  });

  // Topbar Home / Logo
  const homeLink = document.getElementById('topbar-home');
  if (homeLink) {
    homeLink.addEventListener('click', () => {
      showStep('upload');
      selectedDocId = null;
      reRenderQueue();
      // Reset workspace to empty state
      dom.layout.emptyState.classList.remove('hidden');
      dom.layout.docView.classList.add('hidden');
    });
  }

  // Topbar Add Files
  if (dom.buttons.addFiles) {
    dom.buttons.addFiles.addEventListener('click', () => dom.inputs.realFileUpload.click());
  }

  // Export CSV
  if (dom.buttons.exportCsv) {
    dom.buttons.exportCsv.addEventListener('click', exportToCSV);
  }

  // Queue click
  dom.queue.list.addEventListener('click', (e) => {
    const item = e.target.closest('.doc-row');
    if (item) selectDocument(item.dataset.id);
  });

  // Filter tabs
  const tabs = document.querySelectorAll('.inbox-tabs .inbox-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      reRenderQueue();
    });
  });

  // Search
  const searchInput = document.getElementById('queue-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      reRenderQueue();
    });
  }

  // Sort
  const sortSelect = document.getElementById('queue-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortMode = e.target.value;
      reRenderQueue();
    });
  }

  // Toggle Details Pane
  if (dom.banner.btnToggleDetails) {
    dom.banner.btnToggleDetails.addEventListener('click', () => {
      detailsPaneOpen = !detailsPaneOpen;
      dom.techPane.classList.toggle('collapsed', !detailsPaneOpen);
      dom.banner.btnToggleDetailsText.textContent = detailsPaneOpen ? 'Hide Details' : 'View Details';
      
      // Update SVG icon in the button
      const svg = dom.banner.btnToggleDetails.querySelector('svg');
      if (detailsPaneOpen) {
        svg.innerHTML = '<path d="M18 15l-6-6-6 6"/>'; // Chevron up
      } else {
        svg.innerHTML = '<path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M15 18a3 3 0 1 0-6 0"></path><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>'; // List icon
      }
    });
  }

  // Show only exceptions toggle
  if (dom.buttons.showExceptions) {
    dom.buttons.showExceptions.addEventListener('click', () => {
      showOnlyExceptions = !showOnlyExceptions;
      dom.buttons.showExceptions.classList.toggle('active', showOnlyExceptions);
      dom.buttons.showExceptions.textContent = showOnlyExceptions ? 'Show all checks' : 'Show only exceptions';
    });
  }

  // Sample buttons
  dom.buttons.demoCorrect.addEventListener('click', () => handleMockUpload('correct'));
  dom.buttons.demoIncorrect.addEventListener('click', () => handleMockUpload('incorrect'));
}

function reRenderQueue() {
  renderQueue(documentsQueue, selectedDocId, currentFilter, searchTerm, sortMode);
}

async function handleFiles(filesArray) {
  if (filesArray.length === 0) return;

  const newDocs = filesArray.map(f => ({
    id: Math.random().toString(36).substr(2, 9),
    file: f,
    fileName: f.name,
    extractedData: null,
    findings: null,
    overallStatus: 'loading'
  }));

  documentsQueue.push(...newDocs);
  showStep('workspace');
  
  // Auto-select the first newly uploaded file if nothing is selected
  if (!selectedDocId && newDocs.length > 0) {
    selectDocument(newDocs[0].id);
  } else {
    reRenderQueue();
  }

  for (let doc of newDocs) {
    await processDocument(doc.id);
  }
}

async function processDocument(id) {
  const doc = documentsQueue.find(d => d.id === id);
  if (!doc) return;

  try {
    await new Promise(r => setTimeout(r, 400));

    let extracted;
    if (doc.type === 'mock') {
      extracted = await simulateExtraction(doc.mockStatus);
    } else {
      extracted = await extractFromPdf(doc.file);
    }

    const findings = runAuditChecks(extracted.fields);
    const overall = getOverallStatus(findings);

    globalMetrics.processed++;
    if (overall === 'pass') globalMetrics.passed++;
    if (overall === 'review' || overall === 'fail') globalMetrics.review++;
    globalMetrics.timeSavedHours += 0.03;
    updateKPIs(globalMetrics);

    doc.extractedData = extracted;
    doc.findings = findings;
    doc.overallStatus = overall;

  } catch(e) {
    console.error("Processing failed:", doc.fileName, e);
    doc.overallStatus = 'fail';
    doc.findings = [{ title: 'Extraction Error', desc: String(e), status: 'fail' }];
  }

  reRenderQueue();

  if (selectedDocId === id) {
    selectDocument(id);
  }
}

function selectDocument(id) {
  selectedDocId = id;
  reRenderQueue();

  const doc = documentsQueue.find(d => d.id === id);
  if (!doc) return;

  // Show Document View, Hide Empty State
  dom.layout.emptyState.classList.add('hidden');
  dom.layout.docView.classList.remove('hidden');

  // PDF preview
  if (doc.file) {
    if (!doc.previewUrl) doc.previewUrl = URL.createObjectURL(doc.file);
    dom.layout.pdfIframe.src = doc.previewUrl;
  } else if (doc.type === 'mock') {
    // If it's the mock invalid one, maybe try fetching it if it exists inside project dir, else blank
    // A blank frame is fine for simple mocks
    dom.layout.pdfIframe.src = "about:blank";
  }

  if (doc.overallStatus === 'loading') {
    dom.banner.status.textContent = 'Processing...';
    dom.banner.reason.textContent = 'Extracting fields and running rules.';
    dom.banner.summary.textContent = '';
    dom.banner.container.className = 'doc-banner status-loading';
    dom.banner.iconWrap.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:0;border-width:2px;border-color:currentColor;border-top-color:transparent;"></div>';
    
    // Clear proof trail
    dom.proof.foundGrid.innerHTML = '<div class="pf-row"><span class="pf-label">Extracting data...</span></div>';
    dom.proof.timeline.innerHTML = '';

  } else {
    renderExtractedData(doc.extractedData);
    renderAuditResults(doc.findings, doc.overallStatus, doc.extractedData?.fields);
  }
}

async function handleMockUpload(mockStatus) {
  const newDoc = {
    id: Math.random().toString(36).substr(2, 9),
    file: null,
    type: 'mock',
    mockStatus: mockStatus,
    fileName: mockStatus === 'correct' ? 'sample_valid_invoice.pdf' : 'sample_mismatched.pdf',
    extractedData: null,
    findings: null,
    overallStatus: 'loading'
  };
  documentsQueue.push(newDoc);
  showStep('workspace');
  
  if (!selectedDocId) selectDocument(newDoc.id);
  else reRenderQueue();
  
  await processDocument(newDoc.id);
}

function exportToCSV() {
  if (documentsQueue.length === 0) return;

  const headers = ['File','Invoice #','Date','Subtotal','VAT','Total','Currency','Status'];
  const rows = documentsQueue.filter(d => d.overallStatus !== 'loading').map(d => {
    const f = d.extractedData?.fields || {};
    return [
      d.fileName,
      f.invoiceNumber || '',
      f.invoiceDate || '',
      f.subtotal?.toFixed(2) || '',
      f.vatAmount?.toFixed(2) || '',
      f.total?.toFixed(2) || '',
      f.currencySymbol || '',
      d.overallStatus
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditbot_results_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Init
updateKPIs(globalMetrics);
bindEvents();
