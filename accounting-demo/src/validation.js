// src/validation.js

/**
 * Returns an array of audit findings
 * {
 *   title: string,
 *   desc: string,
 *   status: 'pass' | 'fail' | 'review'
 * }
 */
export function runAuditChecks(fields) {
  const findings = [];
  
  // Check 1: Required Fields
  const requiredKeys = ['invoiceNumber', 'invoiceDate', 'subtotal', 'vatRate', 'vatAmount', 'total'];
  let missing = [];
  requiredKeys.forEach(k => {
    if (fields[k] === null || fields[k] === undefined || fields[k] === '') {
      missing.push(k);
    }
  });

  if (missing.length > 0) {
    findings.push({
      title: 'Low Confidence Extraction',
      desc: `Low confidence extraction. Please review values.`,
      status: 'review'
    });
    // Return early if missing fields because math checks will break
    return findings;
  } else {
    findings.push({
      title: 'Required Fields Check',
      desc: 'All essential data points securely extracted.',
      status: 'pass'
    });
  }

  // Check 2: VAT Calculation (subtotal * vatRate = vatAmount)
  const expectedVat = fields.subtotal * fields.vatRate;
  // Absolute match against magnitude since VAT display might be positive on credit notes
  const vatDiff = Math.abs(Math.abs(expectedVat) - Math.abs(fields.vatAmount));
  
  if (vatDiff === 0) {
    findings.push({
      title: 'VAT Calculation Match',
      desc: `Extracted VAT (${fields.vatAmount.toFixed(2)}) perfectly matches subtotal * rate.`,
      status: 'pass'
    });
  } else if (vatDiff <= 0.05) {
    findings.push({
      title: 'VAT Calculation Rounding Difference',
      desc: `Slight mismatch detected in VAT. Expected: ${expectedVat.toFixed(2)}, Found: ${fields.vatAmount.toFixed(2)}`,
      status: 'review'
    });
  } else {
    findings.push({
      title: 'VAT Calculation Discrepancy',
      desc: `Major mismatch. Expected VAT: ${expectedVat.toFixed(2)}, Found: ${fields.vatAmount.toFixed(2)}`,
      status: 'fail'
    });
  }

  // Check 3: Total Calculation (subtotal + vatAmount = total)
  // Credit Notes natively display VAT as a positive sum but mathematically negate it against the Subtotal.
  const signedVatAmount = fields.subtotal < 0 ? -Math.abs(fields.vatAmount) : Math.abs(fields.vatAmount);
  const expectedTotal = fields.subtotal + signedVatAmount;
  const totalDiff = Math.abs(expectedTotal - fields.total);
  
  if (totalDiff === 0) {
    findings.push({
      title: 'Invoice Total Match',
      desc: `Total geometrically validates (Subtotal + VAT = Total).`,
      status: 'pass'
    });
  } else if (totalDiff <= 0.05) {
    findings.push({
      title: 'Total Rounding Difference',
      desc: `Slight mismatch detected in Total. Expected: ${expectedTotal.toFixed(2)}, Found: ${fields.total.toFixed(2)}`,
      status: 'review'
    });
  } else {
    findings.push({
      title: 'Total Calculation Discrepancy',
      desc: `Mathematical fail. Subtotal + VAT = ${expectedTotal.toFixed(2)}, but document states ${fields.total.toFixed(2)}`,
      status: 'fail'
    });
  }

  return findings;
}

/**
 * Derives overall status from findings array
 * 'pass' | 'fail' | 'review'
 */
export function getOverallStatus(findings) {
  const hasFail = findings.some(f => f.status === 'fail');
  const hasReview = findings.some(f => f.status === 'review');
  
  if (hasFail) return 'fail';
  if (hasReview) return 'review';
  return 'pass';
}
