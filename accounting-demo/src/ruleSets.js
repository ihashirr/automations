// src/ruleSets.js

export const ruleSets = {
  basicInvoice: {
    id: 'basicInvoice',
    label: 'Basic Invoice Checks',
    rules: ['requiredFields', 'totalMatch', 'confidenceGate']
  },
  uaeVatStandard: {
    id: 'uaeVatStandard',
    label: 'UAE VAT Standard',
    rules: ['requiredFields', 'vatCalculation', 'totalMatch', 'confidenceGate', 'currencyConsistency']
  },
  creditNote: {
    id: 'creditNote',
    label: 'Credit Note Rules',
    rules: ['requiredFields', 'totalMatch', 'confidenceGate'] // Add specific credit note rule later if needed
  }
};
