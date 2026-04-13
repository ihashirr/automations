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

  const invoiceNoRegex = /(?:Tax\s*(?:Invoice|Credit\s*Note)\s*#|(?:Invoice|Credit\s*Note)(?!\s+Date)\s*(?:No\.?|Number|#)?\s*:?)[\s#:-]*([A-Z0-9-]+)/i;
  // Broad date parser: Supports DD-MM-YYYY, YYYY-MM-DD, Month DD YYYY, DD Month YYYY, with ordinals (st, nd, rd, th) and various delimiters
  const invoiceDateRegex = /Invoice\s*Date[\s\S]{0,50}?([0-9]{1,2}(?:st|nd|rd|th)?[-\/\.\s\u2010-\u2015,]+(?:[A-Za-z]{3,10}|[0-9]{1,2})[-\/\.\s\u2010-\u2015,]+[0-9]{2,4}|[0-9]{4}[-\/\.\s\u2010-\u2015,]+(?:[A-Za-z]{3,10}|[0-9]{1,2})[-\/\.\s\u2010-\u2015,]+[0-9]{1,2}(?:st|nd|rd|th)?|[A-Za-z]{3,10}[-\/\.\s\u2010-\u2015,]+[0-9]{1,2}(?:st|nd|rd|th)?[-\/\.\s\u2010-\u2015,]+[0-9]{2,4})/i;
  const subtotalRegex = /Subtotal\s*:?[\sA-Z]*(-?\s*[0-9,]+\.\d{2})/i;
  const vatAmountRegex = /VAT(?:\s*Amount|\s*\(\s*([0-9]{1,2})%\s*\))?\s*:?[\sA-Z]*(-?\s*[0-9,]+\.\d{2})/i;
  const totalRegex = /\bTotal(?:\s*Amount\s*Payable)?\s*:?[\sA-Z]*(-?\s*[0-9,]+\.\d{2})/i;
  const currencyRegex = /\b(AED|د\.?إ|Dirham|Dirhams|\$|€|£)\b/i;

  // Currency
  const currencyMatch = normalized.match(currencyRegex);
  const currencySymbol = currencyMatch ? currencyMatch[1].toUpperCase() : '$';

  // Invoice Number
  const invMatch = normalized.match(invoiceNoRegex);
  const invoiceNumber = invMatch ? invMatch[1] : null;

  // Invoice Date
  const dateMatch = normalized.match(invoiceDateRegex);
  const invoiceDate = dateMatch ? dateMatch[1] : null;

  const extractAmount = (regex) => {
    const match = normalized.match(regex);
    if (match) {
      // The amount is always the last capturing group for total and subtotal.
      const val = parseFloat(match[match.length - 1].replace(/[,\s]/g, ''));
      return isNaN(val) ? null : val;
    }
    return null;
  };

  const subtotal = extractAmount(subtotalRegex);
  const total = extractAmount(totalRegex);

  let vatRate = null;
  let vatAmount = null;
  const vatMatch = normalized.match(vatAmountRegex);
  if (vatMatch) {
    if (vatMatch[2]) {
      vatAmount = parseFloat(vatMatch[2].replace(/[,\s]/g, ''));
    }
    if (vatMatch[1]) {
      vatRate = parseFloat(vatMatch[1]) / 100;
    }
  }

  // Derive VAT rate from subtotal and vatAmount
  if (!vatRate && subtotal && vatAmount) {
     const computedRate = parseFloat((vatAmount / subtotal).toFixed(4));
     if (computedRate >= 0 && computedRate < 1) { // generic safety
         vatRate = computedRate;
     }
  }

  return {
    invoiceNumber,
    invoiceDate,
    subtotal,
    vatRate,
    vatAmount,
    total,
    currencySymbol
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
