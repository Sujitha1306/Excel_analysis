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
    })).filter(s => s.mapping && Object.keys(s.mapping.columns).length > 0);

    // Group sheets by concept to compare
    const conceptValues: Record<string, { sheetName: string, value: number, actualColumn: string }[]> = {};

    for (const { sheet, mapping: sheetMapping } of mappedSheets) {
      // Internal Check for Location Summary: Source == Destination
      const locationCol = findActualColumnByConcept('location', sheetMapping);
      const rowTypeCol = findActualColumnByConcept('row_type', sheetMapping);
      const isLocationSummary = sheetMapping.sheetType === 'location_summary' || 
        (locationCol && rowTypeCol && sheet.data.some(r => r[rowTypeCol]));

      if (isLocationSummary && rowTypeCol) {
        let sourceCount = 0;
        let destCount = 0;
        sheet.data.forEach(row => {
          const type = String(row[rowTypeCol] ?? '').trim().toLowerCase();
          if (type === 'source') sourceCount++;
          if (type === 'destination') destCount++;
        });

        if (sourceCount !== destCount) {
          issues.push({
            id: `cs-loc-mismatch`,
            issueType: 'Location Source/Destination Mismatch',
            category: 'CRITICAL ERRORS',
            sheetName: sheet.sheetName,
            severity: 'critical',
            condition: `Source count (${sourceCount}) == Destination count (${destCount})`,
            description: 'Source total must equal Destination total in Location Summary',
            affectedRows: [{
              rowNumber: 'Summary level',
              columnName: rowTypeCol,
              actualValue: `Source: ${sourceCount}, Dest: ${destCount}`,
              expectedValue: 'Equal counts'
            }],
            affectedColumns: [rowTypeCol],
            totalAffectedRows: 1,
            remediationSuggestion: 'Ensure every request has both a Source and Destination row in the summary.',
            remediationType: 'manual',
            source: 'rule'
          });
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
              sheetName: current.sheetName,
              severity: 'critical',
              condition: `Total ${concept} matches across all sheets`,
              description: `Total ${concept} in ${current.sheetName} (${current.value}) does not match ${first.sheetName} (${first.value})`,
              affectedRows: [{
                rowNumber: 'Summary level',
                columnName: current.actualColumn,
                actualValue: current.value,
                expectedValue: String(first.value)
              }],
              affectedColumns: [current.actualColumn, first.actualColumn],
              totalAffectedRows: 1,
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
