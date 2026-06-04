import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, CrossSheetCheckResult } from '../types';
import { WorkbookMapping, SheetMapping, getColumnValue } from '../../ai/columnMapper';

function isNumericColumn(
  rows: Record<string, unknown>[],
  columnName: string
): boolean {
  const values = rows
    .map(r => r[columnName])
    .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
    .slice(0, 5);
  if (values.length === 0) return false;
  return values.every(v => !isNaN(Number(v)));
}

function findActualColumnByConcept(concept: string, mapping: SheetMapping): string | undefined {
  if (!mapping || !mapping.columns) return undefined;
  return Object.entries(mapping.columns).find(([_, c]) => c === concept)?.[0];
}

export const crossSheetRules: RuleModule = {
  name: 'cross-sheet-rules',
  run: (workbook: ParsedWorkbook, mapping: WorkbookMapping) => {
    const issues: ValidationIssue[] = [];
    const crossSheetChecks: CrossSheetCheckResult[] = [];

    const countableConcepts = [
      'total_requests', 'completed_count', 'cancelled_count',
      'rejected_count', 'waiting_count', 'open_count'
    ];

    // Find all sheets that have mapping
    const mappedSheets = workbook.sheets.map(sheet => ({
      sheet,
      mapping: mapping[sheet.sheetName]
    })).filter(s => {
      if (!s.mapping || Object.keys(s.mapping.columns).length === 0) return false;
      const lowerName = s.sheet.sheetName.toLowerCase();
      // Only ignore 'porter individual' summaries (not aggregate summaries)
      if (lowerName.includes('porter') && lowerName.includes('individual')) return false;
      return true;
    });

    // Group sheets by concept to compare
    const conceptValues: Record<string, { sheetName: string, value: number, actualColumn: string }[]> = {};

    for (const { sheet, mapping: sheetMapping } of mappedSheets) {
      // Internal Check for Location Summary: Source == Destination
      const locationCol = findActualColumnByConcept('location', sheetMapping);
      const rowTypeCol = findActualColumnByConcept('row_type', sheetMapping);
      const isLocationSummary = sheetMapping.sheetType === 'location_summary' || 
        (locationCol && rowTypeCol && sheet.data.some(r => r[rowTypeCol]));

      if (isLocationSummary && rowTypeCol) {
        const reqCol = findActualColumnByConcept('total_requests', sheetMapping);
        if (reqCol) {
          let sourceSum = 0;
          let destSum = 0;
          sheet.data.forEach(row => {
            const type = String(row[rowTypeCol] ?? '').trim().toLowerCase();
            const val = Number(row[reqCol]);
            if (!isNaN(val)) {
              if (type === 'source') sourceSum += val;
              if (type === 'destination') destSum += val;
            }
          });

          if (sourceSum !== destSum) {
            issues.push({
              id: `cs-loc-mismatch`,
              issueType: 'Count Mismatch Across Sheets',
              category: 'CRITICAL ERRORS',
              sheetName: sheet.sheetName,
              severity: 'critical',
              condition: `Source sum (${sourceSum}) == Destination sum (${destSum})`,
              description: 'Source total must equal Destination total (internal check)',
              affectedRows: [{
                rowNumber: 'Summary level',
                columnName: reqCol,
                actualValue: `Source: ${sourceSum}, Dest: ${destSum}`,
                expectedValue: 'Equal sums'
              }],
              affectedColumns: [reqCol, rowTypeCol],
              totalAffectedRows: 1,
              remediationSuggestion: 'Ensure every request has both a Source and Destination value.',
              remediationType: 'manual',
              source: 'rule'
            });
          }
        }
      }

      // Aggregate concepts
      for (const concept of countableConcepts) {
        const actualCol = findActualColumnByConcept(concept, sheetMapping);
        if (actualCol) {
          if (!isNumericColumn(sheet.data, actualCol)) {
            continue;
          }

          let total = 0;
          if (isLocationSummary && rowTypeCol) {
            // Count Source rows only
            sheet.data.forEach(row => {
              const type = String(row[rowTypeCol] ?? '').trim().toLowerCase();
              if (type === 'source') {
                total += Number(row[actualCol]) || 0;
              }
            });
          } else {
            // Sum all rows
            sheet.data.forEach(row => {
              total += Number(row[actualCol]) || 0;
            });
          }

          if (!conceptValues[concept]) conceptValues[concept] = [];
          conceptValues[concept].push({
            sheetName: sheet.sheetName,
            value: total,
            actualColumn: actualCol
          });
        }
      }
    }

    // Compare aggregated concept totals across sheets
    for (const [concept, sheetsData] of Object.entries(conceptValues)) {
      if (sheetsData.length > 1) {
        const first = sheetsData[0];
        let mismatchFound = false;

        for (let i = 1; i < sheetsData.length; i++) {
          const current = sheetsData[i];
          if (current.value !== first.value) {
            mismatchFound = true;
            crossSheetChecks.push({
              checkName: `${concept} match`,
              passed: false,
              sheetA: first.sheetName,
              sheetB: current.sheetName,
              valueA: String(first.value),
              valueB: String(current.value),
              details: `Mismatch in ${concept}`
            });
            
            issues.push({
              id: `cs-count-${concept}-${i}`,
              issueType: 'Count Mismatch Across Sheets',
              category: 'CRITICAL ERRORS',
              sheetName: `${first.sheetName} ↔ ${current.sheetName}`,
              severity: 'critical',
              condition: `${concept} must be equal across all sheets`,
              description: `${first.sheetName} shows ${first.value} but ${current.sheetName} shows ${current.value} for the same metric. These must be identical as they represent the same data from different views.`,
              affectedRows: [
                {
                  rowNumber: 'Summary level',
                  columnName: `${first.actualColumn} (in ${first.sheetName})`,
                  actualValue: String(first.value),
                  expectedValue: String(current.value)
                },
                {
                  rowNumber: 'Summary level',
                  columnName: `${current.actualColumn} (in ${current.sheetName})`,
                  actualValue: String(current.value),
                  expectedValue: String(first.value)
                }
              ],
              affectedColumns: [first.actualColumn, current.actualColumn],
              totalAffectedRows: 2,
              remediationSuggestion: 'Check if any requests were omitted or double-counted in one of the sheets.',
              remediationType: 'manual',
              source: 'rule'
            });
          } else {
            crossSheetChecks.push({
              checkName: `${concept} match`,
              passed: true,
              sheetA: first.sheetName,
              sheetB: current.sheetName,
              valueA: String(first.value),
              valueB: String(current.value)
            });
          }
        }
      }
    }

    return { issues, crossSheetChecks };
  }
};
