// src/validation.js
import { rules } from './rules.js';
import { ruleSets } from './ruleSets.js';

/**
 * Returns an array of audit findings based on rule set
 * {
 *   id: string,
 *   label: string,
 *   formula: string,
 *   status: 'pass' | 'fail' | 'review'
 * }
 */
export function runRuleSet(fields, ruleSetId, docStatus = 'pass') {
  const findings = [];
  const ruleSet = ruleSets[ruleSetId];
  
  if (!ruleSet) {
    console.error(`Rule set ${ruleSetId} not found.`);
    return findings;
  }

  // Iterate checking rules sequentially
  for (const ruleId of ruleSet.rules) {
    const rule = rules[ruleId];
    if (rule) {
      if (ruleId === 'confidenceGate') {
         findings.push(rule.execute(fields, docStatus));
      } else {
         findings.push(rule.execute(fields));
      }
    }
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
