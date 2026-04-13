// src/mock-data.js

export const correctInvoiceJson = {
  fileName: "invoice_NOV2026.pdf",
  fields: {
    invoiceNumber: "INV-2026-8092",
    invoiceDate: "Nov 15, 2026",
    subtotal: 1000.00,
    vatRate: 0.20,
    vatAmount: 200.00,
    total: 1200.00
  }
};

export const incorrectInvoiceJson = {
  fileName: "invoice_DEC2026_WARN.pdf",
  fields: {
    invoiceNumber: "INV-2026-9011",
    invoiceDate: "Dec 01, 2026",
    subtotal: 1500.00,
    vatRate: 0.20,
    // Error 1: VAT amount calculated wrong (should be 300)
    vatAmount: 250.00,
    // Error 2: Total math is wrong based on even the wrong VAT (1500 + 250 = 1750, not 1800)
    total: 1800.00
  }
};

export const missingFieldsInvoiceJson = {
  fileName: "invoice_JAN2027_ERR.pdf",
  fields: {
    invoiceNumber: "INV-2027-0001",
    invoiceDate: null,
    subtotal: 500.00,
    vatRate: null,
    vatAmount: null,
    total: 500.00
  }
};

// We consider rounding offset a "Needs Review"
export const roundingMismatchJson = {
  fileName: "invoice_FEB2027_REV.pdf",
  fields: {
    invoiceNumber: "INV-2027-1011",
    invoiceDate: "Feb 10, 2027",
    subtotal: 1000.00,
    vatRate: 0.19,
    vatAmount: 190.00,
    total: 1190.05 // small rounding difference of 0.05
  }
};
