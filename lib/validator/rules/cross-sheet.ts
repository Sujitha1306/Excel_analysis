import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, CrossSheetCheckResult, AffectedRow } from '../types';
import { columnGuard } from '../utils';
import { parseDuration } from '../../utils/time';

function getSheet(wb: ParsedWorkbook, type: string): ParsedSheet | undefined {
  return wb.sheets.find(s => s.type === type);
}

function sumCol(sheet: ParsedSheet, colName: string): number {
  return sheet.data.reduce((acc, row) => acc + (parseFloat(row[colName]) || 0), 0);
}

function sumColFiltered(sheet: ParsedSheet, colName: string, filterFn: (row: any) => boolean): number {
  return sheet.data.filter(filterFn).reduce((acc, row) => acc + (parseFloat(row[colName]) || 0), 0);
}

export const crossSheetRules: RuleModule = {
  name: 'cross-sheet-rules',
  
  run: (wb: ParsedWorkbook) => {
    const issues: ValidationIssue[] = [];
    const checks: CrossSheetCheckResult[] = [];

    const dateSummary = getSheet(wb, 'Date Summary');
    const locSummary = getSheet(wb, 'Location Summary');
    const poolSummary = getSheet(wb, 'Pool Summary');
    const perfSummary = getSheet(wb, 'Porter Performance');
    const requestDetails = getSheet(wb, 'Request Details');
    const idleSummary = getSheet(wb, 'Idle Summary');

    // We skip columnGuard pushes here as data-quality handles required fields.

    // Helper to log a failed cross sheet check
    const addCheck = (name: string, sheetA: string, sheetB: string, passed: boolean, valA: number|string, valB: number|string, details?: string) => {
      checks.push({ checkName: name, sheetA, sheetB, passed, valueA: String(valA), valueB: String(valB), details });
      if (!passed) {
        issues.push({
          id: `CS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          issueType: 'Data Mismatch Across Sheets',
          category: 'Data Integrity',
          sheetName: `${sheetA} ↔ ${sheetB}`,
          severity: 'critical',
          condition: 'Cross-sheet totals must match',
          description: `Cross-sheet mismatch: ${name}. ${sheetA} has ${valA}, but ${sheetB} implies ${valB}. ${details || ''}`,
          affectedRows: [
            {
              rowNumber: 0,
              columnName: `${name} — ${sheetA}`,
              actualValue: String(valA),
              expectedValue: String(valB)
            },
            {
              rowNumber: 0,
              columnName: `${name} — ${sheetB}`,
              actualValue: String(valB),
              expectedValue: String(valA)
            }
          ],
          affectedColumns: [name],
          totalAffectedRows: 1,
          remediationSuggestion: `Review both sheets to determine where the data was dropped or miscalculated.`,
          remediationType: 'manual',
          source: 'rule'
        });
      }
    };

    // FR-06: Date Summary total requests = sum of Location Summary rows
    if (dateSummary && locSummary) {
      const dateTotal = sumCol(dateSummary, 'total requests');
      const sourceRows = locSummary.data.filter(r => String(r['type'] ?? '').trim().toLowerCase() === 'source');
      const destRows = locSummary.data.filter(r => String(r['type'] ?? '').trim().toLowerCase() === 'destination');
      
      const locSourceTotal = sourceRows.reduce((sum, row) => sum + (Number(row['requested']) || 0), 0);
      const locDestTotal = destRows.reduce((sum, row) => sum + (Number(row['requested']) || 0), 0);

      addCheck('FR-06: Date Summary Total vs Location Summary Sum', dateSummary.sheetName, locSummary.sheetName, dateTotal === locSourceTotal, dateTotal, locSourceTotal);
      
      if (locSourceTotal !== locDestTotal) {
        addCheck('FR-06-B: Location Summary Source vs Destination', locSummary.sheetName, locSummary.sheetName, false, locSourceTotal, locDestTotal, 'Every request must have exactly one Source and one Destination entry.');
      }
    }

    // FR-07: Date Summary completed = sum of Pool Summary completed
    if (dateSummary && poolSummary) {
      const dateComp = sumCol(dateSummary, 'completed');
      const poolComp = sumCol(poolSummary, 'completed');
      addCheck('FR-07: Date Summary Completed vs Pool Summary', dateSummary.sheetName, poolSummary.sheetName, dateComp === poolComp, dateComp, poolComp);
    }

    // FR-08: Date Summary cancelled = sum of Location Summary cancelled
    if (dateSummary && locSummary) {
      const dateCanc = sumCol(dateSummary, 'cancelled');
      const locCanc = sumColFiltered(locSummary, 'cancelled', r => String(r['type'] ?? '').trim().toLowerCase() === 'source');
      addCheck('FR-08: Date Summary Cancelled vs Location Summary', dateSummary.sheetName, locSummary.sheetName, dateCanc === locCanc, dateCanc, locCanc);
    }

    // FR-09: Porter count on Pool Summary = unique porter IDs in Performance sheet
    if (poolSummary && perfSummary) {
      const poolPorterCount = sumCol(poolSummary, 'porter count');
      const uniquePorters = new Set(perfSummary.data.map(r => r['porter id'])).size;
      if (poolPorterCount > 0) { 
        addCheck('FR-09: Pool Porter Count vs Performance Unique Porters', poolSummary.sheetName, perfSummary.sheetName, poolPorterCount === uniquePorters, poolPorterCount, uniquePorters);
      }
    }

    // FR-10: Date Summary TAT = average of all request-level TAT
    if (dateSummary && requestDetails) {
      const dateTatTotalStr = dateSummary.data[0]?.['tat (create to complete)'];
      if (dateTatTotalStr) {
        const dateTatSec = parseDuration(dateTatTotalStr);
        let validRows = 0;
        let sumSec = 0;
        requestDetails.data.forEach(r => {
          const t = parseDuration(r['tat (create to complete)']);
          if (t > 0) {
            sumSec += t;
            validRows++;
          }
        });
        
        if (validRows > 0) {
          const avgSec = sumSec / validRows;
          const diffPct = Math.abs(avgSec - dateTatSec) / (avgSec || 1);
          const passed = diffPct <= 0.05; // 5% tolerance
          addCheck('FR-10: Date Summary TAT vs Request Details Avg', dateSummary.sheetName, requestDetails.sheetName, passed, dateTatSec, Math.round(avgSec), '5% tolerance allowed.');
        }
      }
    }

    // FR-11: Every porter in Performance sheet has entry in Idle Summary
    if (perfSummary && idleSummary) {
      const idlePorters = new Set(idleSummary.data.map(r => String(r['porter id']).trim().toLowerCase()));
      const missingRows: AffectedRow[] = [];
      perfSummary.data.forEach((r, idx) => {
        const id = String(r['porter id']).trim().toLowerCase();
        if (id && !idlePorters.has(id)) {
          missingRows.push({
            rowNumber: idx + 2,
            columnName: 'porter id',
            actualValue: id,
            expectedValue: 'Must exist in Idle Summary'
          });
        }
      });

      checks.push({ checkName: 'FR-11: Porters in Idle Summary', sheetA: perfSummary.sheetName, sheetB: idleSummary.sheetName, passed: missingRows.length === 0 });
      
      if (missingRows.length > 0) {
        issues.push({
          id: `CS-11-all`,
          issueType: 'Data Mismatch Across Sheets',
          category: 'Data Integrity',
          sheetName: perfSummary.sheetName,
          severity: 'low',
          condition: 'Cross-sheet totals must match',
          description: `Porter(s) present in Performance sheet but missing from Idle Summary.`,
          affectedRows: missingRows,
          affectedColumns: ['porter id'],
          totalAffectedRows: missingRows.length,
          remediationSuggestion: `Review idle tracking system for these porters.`,
          remediationType: 'manual',
          source: 'rule'
        });
      }
    }

    // FR-12: Total time worked per porter in Performance sheet >= sum of TAT values for their completed requests
    if (perfSummary && requestDetails) {
      const porterTatSums: Record<string, number> = {};
      requestDetails.data.forEach(r => {
        const id = String(r['porter id']).trim().toLowerCase();
        const status = String(r['status']).trim().toLowerCase();
        if (status === 'completed' && id) {
          porterTatSums[id] = (porterTatSums[id] || 0) + parseDuration(r['tat (accept to complete)']);
        }
      });

      const timeDeficitRows: AffectedRow[] = [];
      perfSummary.data.forEach((r, idx) => {
        const id = String(r['porter id']).trim().toLowerCase();
        if (id) {
          const totalIntimeSec = parseDuration(r['total intime']);
          const totalTatSec = porterTatSums[id] || 0;
          
          if (totalIntimeSec < totalTatSec) {
            timeDeficitRows.push({
              rowNumber: idx + 2,
              columnName: 'total intime',
              actualValue: `${totalIntimeSec}s (< ${totalTatSec}s TAT)`,
              expectedValue: 'Intime >= TAT Sum'
            });
          }
        }
      });

      if (timeDeficitRows.length > 0) {
        issues.push({
          id: `CS-12-all`,
          issueType: 'Data Mismatch Across Sheets',
          category: 'Data Integrity',
          sheetName: perfSummary.sheetName,
          severity: 'critical',
          condition: 'Cross-sheet totals must match',
          description: `Total intime for porters is less than the sum of their completed requests TAT.`,
          affectedRows: timeDeficitRows,
          affectedColumns: ['total intime', 'porter id'],
          totalAffectedRows: timeDeficitRows.length,
          remediationSuggestion: `Investigate time tracking or overlapping requests for these porters.`,
          remediationType: 'manual',
          source: 'rule'
        });
      }
    }

    return { issues, crossSheetChecks: checks };
  }
};
