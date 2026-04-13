// src/main.js
import './style.css';
import { simulateExtraction, extractFromPdf } from './extraction.js';
import { runAuditChecks, getOverallStatus } from './validation.js';
import { dom, showStep, renderExtractedData, renderAuditResults, showLoader, updateKPIs } from './render.js';

let currentSessionData = null;

// Simulated historical data
let globalMetrics = {
  processed: 1420,
  passed: 1305,
  review: 115,
  timeSavedHours: 42.5
};

function bindEvents() {
  // Step 1: Upload options

  // Mock processing
  dom.buttons.demoCorrect.addEventListener('click', () => handleMockUpload('correct'));
  dom.buttons.demoIncorrect.addEventListener('click', () => handleMockUpload('incorrect'));

  // Real Upload
  dom.inputs.browseFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.inputs.realFileUpload.click();
  });
  dom.inputs.uploadZoneArea.addEventListener('click', (e) => {
    if (e.target === dom.inputs.realFileUpload) return;
    dom.inputs.realFileUpload.click();
  });
  
  dom.inputs.realFileUpload.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleRealUpload(e.target.files[0]);
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
       const file = e.dataTransfer.files[0];
       if (file.type === "application/pdf") {
          handleRealUpload(file);
       } else {
          alert("Please drop a valid PDF file.");
       }
    }
  });

  // Step 2: Extracted actions
  dom.buttons.reUpload.addEventListener('click', () => {
    currentSessionData = null;
    dom.layout.pdfIframe.src = "";
    showStep('upload');
  });

  dom.buttons.runAudit.addEventListener('click', handleRunAudit);

  // Step 3: Finish action
  dom.buttons.finish.addEventListener('click', () => {
    currentSessionData = null;
    dom.layout.pdfIframe.src = "";
    // reset UI state
    dom.auditResultsContainer.classList.add('hidden');
    showStep('upload');
  });
}

async function handleMockUpload(type) {
  prepUploadUI("Extracting demo data...");
  try {
    currentSessionData = await simulateExtraction(type);
    completeUploadPhase();
  } catch (error) {
    console.error(error);
    restoreUploadUI();
  }
}

async function handleRealUpload(file) {
  prepUploadUI("Extracting via PDF.js...");
  try {
    // Generate an object URL for the IFrame preview
    const fileURL = URL.createObjectURL(file);
    dom.layout.pdfIframe.src = fileURL;

    // Run actual extraction
    currentSessionData = await extractFromPdf(file);
    completeUploadPhase();
    
  } catch(error) {
    console.error(error);
    alert("Extraction failed: " + error);
    restoreUploadUI();
  }
}

function prepUploadUI(statusMessage) {
  const actionsZone = document.querySelector('.demo-samples-area');
  const uploadZone = document.querySelector('.upload-zone');
  actionsZone.style.display = 'none';
  uploadZone.style.display = 'none';
  dom.statusText.textContent = statusMessage;
  showLoader(dom.uploadLoader, true);
}

function restoreUploadUI() {
  const actionsZone = document.querySelector('.demo-samples-area');
  const uploadZone = document.querySelector('.upload-zone');
  showLoader(dom.uploadLoader, false);
  actionsZone.style.display = 'block';
  uploadZone.style.display = 'block';
}

function completeUploadPhase() {
  renderExtractedData(currentSessionData);
  showStep('extracted');
  restoreUploadUI(); // reset for next time
}

function handleRunAudit() {
  showStep('audit');
  dom.auditResultsContainer.classList.add('hidden');
  showLoader(dom.auditLoading, true);

  // simulate calculation delay
  setTimeout(() => {
    const findings = runAuditChecks(currentSessionData.fields);
    const overallStatus = getOverallStatus(findings);
    
    // Update KPI metrics
    globalMetrics.processed++;
    if (overallStatus === 'pass') globalMetrics.passed++;
    if (overallStatus === 'review') globalMetrics.review++;
    globalMetrics.timeSavedHours += 0.05; // 3 mins per doc
    updateKPIs(globalMetrics);
    
    renderAuditResults(findings, overallStatus, currentSessionData.fields.currencySymbol);
    
    showLoader(dom.auditLoading, false);
    dom.auditResultsContainer.classList.remove('hidden');
  }, 1000);
}

// Init
updateKPIs(globalMetrics);
bindEvents();
