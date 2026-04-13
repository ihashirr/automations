// src/extraction.js
import { correctInvoiceJson, incorrectInvoiceJson } from './mock-data.js';

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
