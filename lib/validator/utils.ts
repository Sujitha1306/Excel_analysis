import { ParsedSheet, ValidationIssue } from './types';

export function columnGuard(sheet: ParsedSheet, requiredColumns: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!sheet || sheet.rowCount === 0 || !sheet.data || sheet.data.length === 0) return issues;
  
  const firstRow = sheet.data[0] || {};
  const actualColumns = Object.keys(firstRow).map(k => k.toLowerCase());

  for (const reqCol of requiredColumns) {
    const lowerReqCol = reqCol.toLowerCase();
    if (!actualColumns.includes(lowerReqCol)) {
      issues.push({
        id: `col-guard-${sheet.sheetName}-${lowerReqCol.replace(/\s+/g, '-')}`,
        issueType: 'Missing Column',
        category: 'Data Completeness',
        sheetName: sheet.sheetName,
        severity: 'low',
        condition: 'Required columns must be present',
        description: `Required column '${reqCol}' is missing from sheet.`,
        affectedRows: [{
          rowNumber: 1, // Usually headers are row 1
          columnName: reqCol,
          actualValue: 'Missing',
          expectedValue: 'Present'
        }],
        affectedColumns: [reqCol],
        totalAffectedRows: 1,
        remediationSuggestion: `Ensure the export includes the '${reqCol}' column.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }
  }

  return issues;
}
