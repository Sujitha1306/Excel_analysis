import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, AffectedRow } from '../types';
import { parseDuration } from '../../utils/time';
import { columnGuard } from '../utils';

function getSheet(wb: ParsedWorkbook, type: string): ParsedSheet | undefined {
  return wb.sheets.find(s => s.type === type);
}

export const porterPerformanceRules: RuleModule = {
  name: 'porter-performance-rules',
  
  run: (wb: ParsedWorkbook) => {
    const issues: ValidationIssue[] = [];
    
    const porterPerformance = getSheet(wb, 'Porter Performance');
    const requestDetails = getSheet(wb, 'Request Details');

    if (!porterPerformance || !requestDetails) return { issues };

    // Pre-calculate completed requests per porter from Request Details
    const actualCompletedCounts = new Map<string, number>();
    if (requestDetails) {
      requestDetails.data.forEach(row => {
        const id = String(row['porter id'] || '').trim().toLowerCase();
        const status = String(row['status'] || '').trim().toLowerCase();
        if (id && status === 'completed') {
          actualCompletedCounts.set(id, (actualCompletedCounts.get(id) || 0) + 1);
        }
      });
    }

    const mismatchRows: AffectedRow[] = [];
    const intimeRows: AffectedRow[] = [];

    porterPerformance.data.forEach((row, rowIndex) => {
      const displayRow = rowIndex + 2;
      const porterIdRaw = row['porter id'];
      if (!porterIdRaw) return;
      const porterId = String(porterIdRaw).trim();
      const porterIdLower = porterId.toLowerCase();

      // FR-19: Completed count per porter in Performance = count in Request Details
      if (requestDetails) {
        const claimedCompleted = parseInt(row['completed'], 10) || 0;
        const actualCompleted = actualCompletedCounts.get(porterIdLower) || 0;

        if (claimedCompleted !== actualCompleted) {
          mismatchRows.push({
            rowNumber: displayRow,
            columnName: 'completed',
            actualValue: claimedCompleted,
            expectedValue: String(actualCompleted)
          });
        }
      }

      // FR-20: Total Intime >= Total Time (Accept to Complete)
      const intimeStr = row['total intime'];
      const totalTatStr = row['total time (accept to complete)'];

      if (intimeStr && totalTatStr) {
        const intime = parseDuration(intimeStr);
        const totalTat = parseDuration(totalTatStr);

        if (intime < totalTat) {
          intimeRows.push({
            rowNumber: displayRow,
            columnName: 'total intime / total time',
            actualValue: `${intimeStr} < ${totalTatStr}`,
            expectedValue: 'Intime >= Total Time'
          });
        }
      }
    });

    if (mismatchRows.length > 0) {
      issues.push({
        id: `PP-19-all`,
        issueType: 'Data Mismatch Across Sheets',
        category: 'Data Integrity',
        sheetName: porterPerformance.sheetName,
        severity: 'critical',
        condition: 'Cross-sheet totals must match',
        description: `Porter claims completed requests, but Request Details shows a different amount.`,
        affectedRows: mismatchRows,
        affectedColumns: ['completed'],
        totalAffectedRows: mismatchRows.length,
        remediationSuggestion: `Investigate missing or dropped requests for these porters in the raw data export.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    if (intimeRows.length > 0) {
      issues.push({
        id: `PP-20-all`,
        issueType: 'Formula Error',
        category: 'Logic Integrity',
        sheetName: porterPerformance.sheetName,
        severity: 'critical',
        condition: 'Intime must encapsulate total task time',
        description: `Porters have Total Intime less than Total Time Accept to Complete.`,
        affectedRows: intimeRows,
        affectedColumns: ['total intime', 'total time (accept to complete)'],
        totalAffectedRows: intimeRows.length,
        remediationSuggestion: `Review time tracking accuracy.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    return { issues };
  }
};
