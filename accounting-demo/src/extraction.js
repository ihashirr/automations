// src/extraction.js
import { correctInvoiceJson, incorrectInvoiceJson } from './mock-data.js';

export async function extractFromPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        
        // Wait for PDF.js library to grab the document
        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        
        // Loop through pages
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + ' ';
        }

        console.log("Raw Extracted Text:", fullText);
        const extractedFields = runHeuristics(fullText);
        
        resolve({
          fileName: file.name,
          fields: extractedFields
        });
        
      } catch (e) {
        console.error(e);
        reject('Failed to parse PDF using pdf.js');
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
}

function runHeuristics(text) {
  // Normalize text to avoid missing whitespace
  const normalized = text.replace(/\s+/g, ' ');

  // VERY basic regex heuristic logic for demo purposes. 
  // It covers common structures but is intentionally fragile to trigger "Needs Review" on complex files.
  
  // Invoice Number (ignore 'Invoice Date')
  const invMatch = normalized.match(/Invoice(?!\s+Date)\s*(?:No\.?|#|Number)?[\s:]*([A-Z0-9\-]+)/i);
  const invoiceNumber = invMatch ? invMatch[1] : null;

  // Invoice Date
  // looks for Date: Nov 15, 2026 or 15/11/2026 etc
  const dateMatch = normalized.match(/Date[:\s]*([A-Z0-9\-\/,\s]+)/i);
  // remove trailing words like "Due" that might get scooped up
  const invoiceDate = dateMatch ? dateMatch[1].substring(0, 15).replace(/(?:\bDue\b|\bInvoice\b|AED|\$|€).*$/i, '').trim() : null;

  // Currency extraction helper (use non-greedy match .*? to skip any currency symbol like 'AED ' or '$')
  const extractAmount = (regex) => {
    const match = normalized.match(regex);
    if (match) {
      // Remove commas and parse to float
      const val = parseFloat(match[1].replace(/,/g, ''));
      return isNaN(val) ? null : val;
    }
    return null;
  };

  // Subtotal
  const subtotal = extractAmount(/Subtotal.*?([0-9,]+\.[0-9]{2})/i);
  
  // VAT / Tax
  const vatAmount = extractAmount(/(?:VAT|Tax).*?([0-9,]+\.[0-9]{2})/i);
  
  // Total
  const total = extractAmount(/(?:Total|Amount Due|Balance Due).*?([0-9,]+\.[0-9]{2})/i);

  // Derive VAT rate from subtotal and vatAmount
  let vatRate = null;
  if (subtotal && vatAmount) {
    vatRate = parseFloat((vatAmount / subtotal).toFixed(4));
  } else {
      // Just try to find a raw percentage like 20%
      const rateMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
      if (rateMatch) {
         vatRate = parseFloat(rateMatch[1]) / 100;
      }
  }

  return {
    invoiceNumber,
    invoiceDate,
    subtotal,
    vatRate,
    vatAmount,
    total
  };
}

/**
 * Simulates a delay representing an OCR / Layout LM extraction process
 */
export async function simulateExtraction(type = 'correct') {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (type === 'correct') {
        resolve(correctInvoiceJson);
      } else {
        resolve(incorrectInvoiceJson);
      }
    }, 1500); // 1.5 seconds mock delay
  });
}
