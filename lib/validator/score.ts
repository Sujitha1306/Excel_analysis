import { ValidationReport } from './types';

/**
 * Calculates the Data Quality Score (0-100) based on the issues found.
 * Rules:
 * Start at 100
 * Deduct 10 per Critical (cap -50)
 * Deduct 3 per Medium (cap -30)
 * Deduct 1 per Low (cap -20)
 * Returns 0-100
 */
export function calculateQualityScore(report: ValidationReport): number {
  let criticalCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const issue of report.issues) {
    if (issue.severity === 'critical') criticalCount++;
    else if (issue.severity === 'medium') mediumCount++;
    else if (issue.severity === 'low') lowCount++;
  }

  const criticalDeduction = Math.min(criticalCount * 10, 50);
  const mediumDeduction = Math.min(mediumCount * 3, 30);
  const lowDeduction = Math.min(lowCount * 1, 20);

  const totalDeduction = criticalDeduction + mediumDeduction + lowDeduction;
  
  return Math.max(0, 100 - totalDeduction);
}
