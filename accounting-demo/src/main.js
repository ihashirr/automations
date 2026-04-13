// src/main.js
import './style.css';
import { simulateExtraction, extractFromPdf } from './extraction.js';
import { runAuditChecks, getOverallStatus } from './validation.js';
import { dom, showStep, renderExtractedData, renderAuditResults, showLoader, updateKPIs, renderQueue } from './render.js';

let documentsQueue = [];
let selectedDocId = null;
let currentFilter = 'all';

// Simulated historical data — feels like a live system
let globalMetrics = {
  processed: 1420,
  passed: 1305,
  review: 115,
  timeSavedHours: 42.5
};

function bindEvents() {
  // Browse Files button in upload screen
  dom.inputs.browseFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.inputs.realFileUpload.click();
  });
  // Click anywhere in upload zone
  dom.inputs.uploadZoneArea.addEventListener('click', (e) => {
    if (e.target === dom.inputs.realFileUpload || e.target.closest('.btn')) return;
    dom.inputs.realFileUpload.click();
  });
  
  // File input change (multi-file)
  dom.inputs.realFileUpload.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      e.target.value = ''; // allow re-selecting same files
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

  // Topbar "Add Files" button→ opens file picker from workspace
  if (dom.buttons.addFiles) {
    dom.buttons.addFiles.addEventListener('click', () => {
      dom.inputs.realFileUpload.click();
    });
  }

  // Export CSV
  if (dom.buttons.exportCsv) {
    dom.buttons.exportCsv.addEventListener('click', exportToCSV);
  }

  // Re-upload / Add more from right panel
  if (dom.buttons.reUpload) {
    dom.buttons.reUpload.addEventListener('click', () => {
      dom.inputs.realFileUpload.click();
    });
  }

  // Queue click handling (event delegation)
  dom.queue.list.addEventListener('click', (e) => {
    const item = e.target.closest('.queue-item');
    if (item) {
       selectDocument(item.dataset.id);
    }
  });

  // Queue Filter chips
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
       chips.forEach(c => c.classList.remove('active'));
       e.target.classList.add('active');
       currentFilter = e.target.dataset.filter;
       renderQueue(documentsQueue, selectedDocId, currentFilter);
    });
  });

  // Mock processing (sample buttons)
  dom.buttons.demoCorrect.addEventListener('click', () => handleMockUpload('correct'));
  dom.buttons.demoIncorrect.addEventListener('click', () => handleMockUpload('incorrect'));
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
  
  // Transition to workspace
  showStep('workspace');
  renderQueue(documentsQueue, selectedDocId, currentFilter);

  // Process sequentially for demo effect
  for (let doc of newDocs) {
     await processDocument(doc.id);
  }
}

async function processDocument(id) {
  const doc = documentsQueue.find(d => d.id === id);
  if (!doc) return;
  
  try {
     // Small delay for sequential demo flow
     await new Promise(r => setTimeout(r, 400));

     let extracted;
     if (doc.type === 'mock') {
        extracted = await simulateExtraction(doc.mockStatus);
     } else {
        extracted = await extractFromPdf(doc.file);
     }

     const findings = runAuditChecks(extracted.fields);
     const overall = getOverallStatus(findings);
     
     // Update global KPI metrics
     globalMetrics.processed++;
     if (overall === 'pass') globalMetrics.passed++;
     if (overall === 'review' || overall === 'fail') globalMetrics.review++;
     globalMetrics.timeSavedHours += 0.03; // ~2 min per doc
     updateKPIs(globalMetrics);
     
     // Store results
     doc.extractedData = extracted;
     doc.findings = findings;
     doc.overallStatus = overall;
     
  } catch(e) {
     console.error("Processing failed:", doc.fileName, e);
     doc.overallStatus = 'fail';
     doc.findings = [{ title: 'Extraction Error', desc: String(e), status: 'fail' }];
  }
  
  renderQueue(documentsQueue, selectedDocId, currentFilter);
  
  // Auto-select first completed document
  if (!selectedDocId) {
     selectDocument(id);
  } else if (selectedDocId === id) {
     selectDocument(id); // refresh
  }
}

function selectDocument(id) {
  selectedDocId = id;
  renderQueue(documentsQueue, selectedDocId, currentFilter);
  
  const doc = documentsQueue.find(d => d.id === id);
  if (!doc) return;
  
  // Show PDF preview
  if (doc.file) {
    if (!doc.previewUrl) {
       doc.previewUrl = URL.createObjectURL(doc.file);
    }
    dom.layout.pdfIframe.src = doc.previewUrl;
  } else if (doc.type === 'mock') {
    dom.layout.pdfIframe.src = "about:blank";
  }

  // Update preview doc name
  if (dom.previewDocName) dom.previewDocName.textContent = doc.fileName;
  
  if (doc.overallStatus === 'loading') {
    dom.auditResultsContainer.classList.add('hidden');
    dom.extractedGrid.innerHTML = '<p style="padding: 20px; color: var(--text-muted); font-size: 13px;">Extracting data…</p>';
    dom.fileNameDisplay.textContent = doc.fileName;
  } else {
    dom.auditResultsContainer.classList.remove('hidden');
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
   renderQueue(documentsQueue, selectedDocId, currentFilter);
   await processDocument(newDoc.id);
}

function exportToCSV() {
  if (documentsQueue.length === 0) return;
  
  const headers = ['File', 'Invoice #', 'Date', 'Subtotal', 'VAT', 'Total', 'Currency', 'Status', 'Confidence'];
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
      d.overallStatus,
      ''
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
