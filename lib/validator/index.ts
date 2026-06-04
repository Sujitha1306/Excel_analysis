import { detectSheetType } from './sheet-detector';
import { ParsedWorkbook, ParsedSheet, ValidationReport, ValidationIssue, CrossSheetCheckResult } from './types';
import { crossSheetRules } from './rules/cross-sheet';
import { requestDetailsRules } from './rules/request-details';
import { porterPerformanceRules } from './rules/porter-performance';
import { locationSummaryRules } from './rules/location-summary';
import { poolSummaryRules } from './rules/pool-summary';
import { dataQualityRules } from './rules/data-quality';
import { calculateQualityScore } from './score';

export type { ParsedWorkbook, ParsedSheet, ValidationReport, ValidationIssue };

/**
 * Runs all validation rules against a parsed workbook and generates a final report.
 */
export function runValidationPipeline(workbook: ParsedWorkbook): ValidationReport {
  let issues: ValidationIssue[] = [];
  let crossSheetChecks: CrossSheetCheckResult[] = [];

  const runRule = (ruleModule: any) => {
    try {
      const result = ruleModule.run(workbook);
      issues = issues.concat(result.issues || []);
      if (result.crossSheetChecks) {
        crossSheetChecks = crossSheetChecks.concat(result.crossSheetChecks);
      }
    } catch (e) {
      console.error(`Error running rule ${ruleModule.name}:`, e);
    }
  };

  runRule(crossSheetRules);
  runRule(requestDetailsRules);
  runRule(porterPerformanceRules);
  runRule(locationSummaryRules);
  runRule(poolSummaryRules);
  runRule(dataQualityRules);

  let criticalCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const issue of issues) {
    if (issue.severity === 'critical') criticalCount++;
    if (issue.severity === 'medium') mediumCount++;
    if (issue.severity === 'low') lowCount++;
  }

  const report: ValidationReport = {
    fileName: workbook.fileName,
    validatedAt: new Date(),
    totalIssues: issues.length,
    criticalCount,
    mediumCount,
    lowCount,
    qualityScore: 0,
    issues,
    sheetsAnalyzed: workbook.sheets.map(s => s.sheetName),
    crossSheetChecks
  };

  report.qualityScore = calculateQualityScore(report);
  return report;
}
