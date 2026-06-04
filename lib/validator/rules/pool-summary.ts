import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, AffectedRow } from '../types';
import { columnGuard } from '../utils';

function getSheet(wb: ParsedWorkbook, type: string): ParsedSheet | undefined {
  return wb.sheets.find(s => s.type === type);
}

export const poolSummaryRules: RuleModule = {
  name: 'pool-summary-rules',
  
  run: (wb: ParsedWorkbook) => {
    const issues: ValidationIssue[] = [];
    
    const poolSummary = wb.sheets.find(s => s.type === 'Pool Summary');
    if (!poolSummary) return { issues };

    const mismatchRows: AffectedRow[] = [];

    poolSummary.data.forEach((row, rowIndex) => {
      const poolName = String(row['pool name'] || '').trim();
      if (!poolName || poolName.toLowerCase() === 'total') return;

      const totalRequests = parseInt(row['total requests'], 10) || 0;
      const completed = parseInt(row['completed'], 10) || 0;
      const cancelled = parseInt(row['cancelled'], 10) || 0;
      const open = parseInt(row['open'], 10) || 0;
      const rejected = parseInt(row['rejected'], 10) || 0;

      // FR-22: Completed + Cancelled + Open + Rejected = Total Requests
      const sum = completed + cancelled + open + rejected;
      if (sum !== totalRequests) {
        mismatchRows.push({
          rowNumber: rowIndex + 2,
          columnName: 'total requests / components sum',
          actualValue: `${totalRequests} != ${sum} (C:${completed}, C:${cancelled}, O:${open}, R:${rejected})`,
          expectedValue: 'Total Requests = Completed + Cancelled + Open + Rejected'
        });
      }
    });

    if (mismatchRows.length > 0) {
      issues.push({
        id: `PS-22-all`,
        issueType: 'Formula Error',
        category: 'Logic Integrity',
        sheetName: poolSummary.sheetName,
        severity: 'critical',
        condition: 'Pool components must sum to total requests',
        description: `Pools have total requests that do not match the sum of Completed, Cancelled, Open, and Rejected.`,
        affectedRows: mismatchRows,
        affectedColumns: ['total requests', 'completed', 'cancelled', 'open', 'rejected'],
        totalAffectedRows: mismatchRows.length,
        remediationSuggestion: `Verify the breakdown counts for these pools.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    return { issues };
  }
};
