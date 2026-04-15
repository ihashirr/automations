// src/ruleSets.js

export const ruleSets = {
  basicInvoice: {
    id: 'basicInvoice',
    label: 'Basic Invoice Checks',
    rules: ['requiredFields', 'totalMatch', 'confidenceGate', 'dateValidity']
  },
  uaeVatStandard: {
    id: 'uaeVatStandard',
    label: 'UAE VAT Standard',
    rules: ['requiredFields', 'vatCalculation', 'totalMatch', 'confidenceGate', 'currencyConsistency', 'dateValidity']
  },
  creditNote: {
    id: 'creditNote',
    label: 'Credit Note Rules',
    rules: ['requiredFields', 'totalMatch', 'confidenceGate', 'dateValidity'] // Add specific credit note rule later if needed
  }
};
