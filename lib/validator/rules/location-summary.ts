import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, AffectedRow } from '../types';
import { columnGuard } from '../utils';

function getSheet(wb: ParsedWorkbook, type: string): ParsedSheet | undefined {
  return wb.sheets.find(s => s.type === type);
}

export const locationSummaryRules: RuleModule = {
  name: 'location-summary-rules',
  
  run: (wb: ParsedWorkbook) => {
    const issues: ValidationIssue[] = [];
    
    const locationSummary = wb.sheets.find(s => s.type === 'Location Summary');
    if (!locationSummary) return { issues };

    const mismatchRows: AffectedRow[] = [];

    locationSummary.data.forEach((row, rowIndex) => {
      const location = String(row['location'] || '').trim();
      if (!location) return;

      const requested = parseInt(row['requested'], 10) || 0;
      const completed = parseInt(row['completed'], 10) || 0;
      const rejected = parseInt(row['rejected'], 10) || 0;
      const cancelled = parseInt(row['cancelled'], 10) || 0;

      // FR-21: Completed + Rejected + Cancelled = Requested
      const sum = completed + rejected + cancelled;
      if (sum !== requested) {
        mismatchRows.push({
          rowNumber: rowIndex + 2,
          columnName: 'requested / components sum',
          actualValue: `${requested} != ${sum} (C:${completed}, R:${rejected}, C:${cancelled})`,
          expectedValue: 'Requested = Completed + Rejected + Cancelled'
        });
      }
    });

    if (mismatchRows.length > 0) {
      issues.push({
        id: `LS-21-all`,
        issueType: 'Formula Error',
        category: 'Logic Integrity',
        sheetName: locationSummary.sheetName,
        severity: 'critical',
        condition: 'Location components must sum to requested',
        description: `Locations have requested counts that do not match the sum of Completed, Rejected, and Cancelled.`,
        affectedRows: mismatchRows,
        affectedColumns: ['requested', 'completed', 'rejected', 'cancelled'],
        totalAffectedRows: mismatchRows.length,
        remediationSuggestion: `Verify the breakdown counts. One of the states may be missing or double-counted.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    return { issues };
  }
};
