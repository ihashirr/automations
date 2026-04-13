// src/main.js
import './style.css';
import { simulateExtraction, extractFromPdf } from './extraction.js';
import { runAuditChecks, getOverallStatus } from './validation.js';
import { dom, showStep, renderExtractedData, renderAuditResults, showLoader, updateKPIs, renderQueue } from './render.js';

let documentsQueue = [];
let selectedDocId = null;
let currentFilter = 'all';
let pdfDrawerOpen = false;
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

  // Topbar Add Files
  if (dom.buttons.addFiles) {
    dom.buttons.addFiles.addEventListener('click', () => dom.inputs.realFileUpload.click());
  }

  // Export CSV
  if (dom.buttons.exportCsv) {
    dom.buttons.exportCsv.addEventListener('click', exportToCSV);
  }

  // Right-panel Add More
  if (dom.buttons.reUpload) {
    dom.buttons.reUpload.addEventListener('click', () => dom.inputs.realFileUpload.click());
  }

  // Queue click
  dom.queue.list.addEventListener('click', (e) => {
    const item = e.target.closest('.queue-item');
    if (item) selectDocument(item.dataset.id);
  });

  // Filter chips
  const chips = document.querySelectorAll('.queue-filters .chip');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      chips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderQueue(documentsQueue, selectedDocId, currentFilter);
    });
  });

  // PDF Drawer toggle
  if (dom.buttons.togglePdf) {
    dom.buttons.togglePdf.addEventListener('click', () => {
      pdfDrawerOpen = !pdfDrawerOpen;
      dom.pdfDrawerBody.classList.toggle('collapsed', !pdfDrawerOpen);
      dom.drawerChevron.classList.toggle('open', pdfDrawerOpen);
    });
  }

  // Show only exceptions toggle
  if (dom.buttons.showExceptions) {
    dom.buttons.showExceptions.addEventListener('click', () => {
      showOnlyExceptions = !showOnlyExceptions;
      dom.buttons.showExceptions.classList.toggle('active', showOnlyExceptions);
      dom.buttons.showExceptions.textContent = showOnlyExceptions ? 'Show all checks' : 'Show only exceptions';
      // Re-render if we have a selected doc
      if (selectedDocId) {
        const doc = documentsQueue.find(d => d.id === selectedDocId);
        if (doc && doc.overallStatus !== 'loading') {
          filterAuditRows();
        }
      }
    });
  }

  // Sample buttons
  dom.buttons.demoCorrect.addEventListener('click', () => handleMockUpload('correct'));
  dom.buttons.demoIncorrect.addEventListener('click', () => handleMockUpload('incorrect'));
}

function filterAuditRows() {
  const rows = dom.auditTableBody.querySelectorAll('tr');
  rows.forEach(row => {
    if (showOnlyExceptions) {
      const hasIssue = row.classList.contains('row-fail') || row.classList.contains('row-review');
      row.style.display = hasIssue ? '' : 'none';
    } else {
      row.style.display = '';
    }
  });
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
  renderQueue(documentsQueue, selectedDocId, currentFilter);

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

  renderQueue(documentsQueue, selectedDocId, currentFilter);

  if (!selectedDocId) {
    selectDocument(id);
  } else if (selectedDocId === id) {
    selectDocument(id);
  }
}

function selectDocument(id) {
  selectedDocId = id;
  renderQueue(documentsQueue, selectedDocId, currentFilter);

  const doc = documentsQueue.find(d => d.id === id);
  if (!doc) return;

  // PDF preview
  if (doc.file) {
    if (!doc.previewUrl) doc.previewUrl = URL.createObjectURL(doc.file);
    dom.layout.pdfIframe.src = doc.previewUrl;
  } else if (doc.type === 'mock') {
    dom.layout.pdfIframe.src = "about:blank";
  }

  if (dom.previewDocName) dom.previewDocName.textContent = doc.fileName;

  if (doc.overallStatus === 'loading') {
    dom.auditResultsContainer.classList.add('hidden');
    dom.extractedTableBody.innerHTML = '<tr><td colspan="4" style="padding:20px; color:var(--text-muted);">Extracting data…</td></tr>';
    dom.fileNameDisplay.textContent = doc.fileName;
  } else {
    dom.auditResultsContainer.classList.remove('hidden');
    renderExtractedData(doc.extractedData);
    renderAuditResults(doc.findings, doc.overallStatus, doc.extractedData?.fields);
    filterAuditRows(); // respect current exception filter
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
  renderQueue(documentsQueue, selectedDocId, currentFilter);
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
