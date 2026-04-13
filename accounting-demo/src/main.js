// src/main.js
import './style.css';
import { simulateExtraction } from './extraction.js';
import { runAuditChecks, getOverallStatus } from './validation.js';
import { dom, showStep, renderExtractedData, renderAuditResults, showLoader } from './render.js';

let currentSessionData = null;

function bindEvents() {
  // Step 1: Upload options
  dom.buttons.demoCorrect.addEventListener('click', () => handleUpload('correct'));
  dom.buttons.demoIncorrect.addEventListener('click', () => handleUpload('incorrect'));

  // Step 2: Extracted actions
  dom.buttons.reUpload.addEventListener('click', () => {
    currentSessionData = null;
    showStep('upload');
  });

  dom.buttons.runAudit.addEventListener('click', handleRunAudit);

  // Step 3: Finish action
  dom.buttons.finish.addEventListener('click', () => {
    currentSessionData = null;
    // reset UI state
    dom.auditResultsContainer.classList.add('hidden');
    showStep('upload');
  });
}

async function handleUpload(type) {
  // Show loader, hide buttons
  const actionsZone = document.querySelector('.demo-actions');
  actionsZone.style.display = 'none';
  showLoader(dom.uploadLoader, true);

  try {
    currentSessionData = await simulateExtraction(type);
    renderExtractedData(currentSessionData);
    showStep('extracted');
  } catch (error) {
    console.error("Extraction failed", error);
    alert("Extraction mocked failure.");
  } finally {
    // Restore UI state for later
    showLoader(dom.uploadLoader, false);
    actionsZone.style.display = 'flex';
  }
}

function handleRunAudit() {
  showStep('audit');
  dom.auditResultsContainer.classList.add('hidden');
  showLoader(dom.auditLoading, true);

  // simulate calculation delay
  setTimeout(() => {
    const findings = runAuditChecks(currentSessionData.fields);
    const overallStatus = getOverallStatus(findings);
    
    renderAuditResults(findings, overallStatus);
    
    showLoader(dom.auditLoading, false);
    dom.auditResultsContainer.classList.remove('hidden');
  }, 1000);
}

// Init
bindEvents();
