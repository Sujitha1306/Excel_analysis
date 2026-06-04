import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, AffectedRow } from '../types';
import { parseDuration } from '../../utils/time';
import { detectOutliers } from '../../utils/stats';
import { columnGuard } from '../utils';

export const dataQualityRules: RuleModule = {
  name: 'data-quality-rules',
  
  run: (wb: ParsedWorkbook) => {
    const issues: ValidationIssue[] = [];

    // Grouping collections
    const missingValuesByReq: Record<string, AffectedRow[]> = {};
    const ghostColumns: AffectedRow[] = [];
    const whitespaceDetected: AffectedRow[] = [];

    
    // FR-29: track names mapped to IDs across the whole workbook
    const porterIdToNames = new Map<string, Set<{ name: string, row: number, sheet: string }>>();

    // Per-pool TATs for FR-31
    const poolTats = new Map<string, { val: number; sheetName: string; row: number }[]>();

    for (const sheet of wb.sheets) {
      sheet.data.forEach((row, rowIndex) => {
        const displayRow = rowIndex + 2;

        // Collect porter IDs and names (FR-29)
        const porterId = String(row['porter id'] || '').trim().toLowerCase();
        const porterName = String(row['porter name'] || '');
        
        if (porterId && porterName.trim()) {
          if (!porterIdToNames.has(porterId)) {
            porterIdToNames.set(porterId, new Set());
          }
          porterIdToNames.get(porterId)!.add({ name: porterName.trim(), row: displayRow, sheet: sheet.sheetName });
        }

        // FR-24: Blank required fields
        const requiredFields = ['porter name', 'requestid', 'start time', 'end time', 'status', 'pool name'];
        for (const req of requiredFields) {
          if (row.hasOwnProperty(req)) {
            const val = String(row[req] || '');
            if (val.trim() === '') {
              const key = `${sheet.sheetName}-${req}`;
              if (!missingValuesByReq[key]) missingValuesByReq[key] = [];
              missingValuesByReq[key].push({
                rowNumber: displayRow,
                columnName: req,
                actualValue: val,
                expectedValue: 'Non-empty value'
              });
            }
          }
        }

        // Check all string fields for whitespace issues (FR-25, FR-26, FR-27)
        for (const [key, val] of Object.entries(row)) {
          if (typeof val === 'string') {
            // FR-27: Ghost columns
            if (key.toLowerCase().startsWith('__empty') && val.trim() !== '') {
              ghostColumns.push({
                rowNumber: displayRow,
                columnName: key,
                actualValue: val
              });
            }

            // FR-25 & FR-26 Whitespace logic
            const strValue = String(val);
            const trimmed = strValue.trim();

            if (
              val !== null && 
              val !== undefined && 
              strValue !== '' &&
              strValue !== trimmed && 
              (key.includes('name') || key.includes('category') || trimmed === '') // Flag if name/category has spaces, or if it's purely whitespace
            ) {
              whitespaceDetected.push({
                rowNumber: displayRow,
                columnName: key,
                actualValue: strValue,
                expectedValue: trimmed
              });
            }
          }
        }

        if (sheet.type === 'Request Details') {
          const pool = String(row['pool name'] || '').trim();
          const tatStr = String(row['tat (create to complete)'] || '').trim();
          if (pool && tatStr) {
            const tatSec = parseDuration(tatStr);
            if (tatSec > 0) {
              if (!poolTats.has(pool)) poolTats.set(pool, []);
              poolTats.get(pool)!.push({ val: tatSec, sheetName: sheet.sheetName, row: displayRow });
            }
          }
        }
      });
    }

    // Process FR-24 (Missing Values)
    for (const [key, rows] of Object.entries(missingValuesByReq)) {
      if (rows.length > 0) {
        const [sheetName, req] = key.split('-');
        issues.push({
          id: `DQ-24-${key}`,
          issueType: 'Missing Values',
          category: 'Data Completeness',
          sheetName,
          severity: 'medium',
          condition: 'Value is NULL or Empty',
          description: `Required field '${req}' is missing.`,
          affectedRows: rows,
          affectedColumns: [req],
          totalAffectedRows: rows.length,
          remediationSuggestion: `Provide the missing value for ${req}.`,
          remediationType: 'manual',
          source: 'rule'
        });
      }
    }

    // Process FR-27 (Ghost Columns)
    if (ghostColumns.length > 0) {
      issues.push({
        id: `DQ-27-all`,
        issueType: 'Ghost Column',
        category: 'Data Quality',
        sheetName: 'Multiple',
        severity: 'medium',
        condition: 'Column contains data but has no header',
        description: `Ghost columns detected: Data found in columns without a header.`,
        affectedRows: ghostColumns,
        affectedColumns: Array.from(new Set(ghostColumns.map(r => r.columnName))),
        totalAffectedRows: ghostColumns.length,
        remediationSuggestion: `Remove the ghost columns or provide valid headers.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    // Process FR-26 (Leading/Trailing Whitespace)
    if (whitespaceDetected.length > 0) {
      issues.push({
        id: `DQ-26-all`,
        issueType: 'Whitespace Issue',
        category: 'Data Quality',
        sheetName: 'Multiple',
        severity: 'medium',
        condition: 'Extraneous whitespace detected',
        description: `Fields have leading/trailing spaces or contain only whitespace.`,
        affectedRows: whitespaceDetected,
        affectedColumns: Array.from(new Set(whitespaceDetected.map(r => r.columnName))),
        totalAffectedRows: whitespaceDetected.length,
        remediationSuggestion: `Trim the whitespace from these fields.`,
        remediationType: 'auto',
        source: 'rule'
      });
    }

    // FR-29: Inconsistent names for same ID
    const inconsistentPorterRows: AffectedRow[] = [];
    for (const [id, entries] of Array.from(porterIdToNames.entries())) {
      const distinctNames = Array.from(new Set(Array.from(entries).map(e => e.name)));
      if (distinctNames.length > 1) {
        entries.forEach(e => {
          inconsistentPorterRows.push({
            rowNumber: e.row,
            columnName: 'porter name',
            actualValue: `${id} -> ${e.name}`
          });
        });
      }
    }

    if (inconsistentPorterRows.length > 0) {
      issues.push({
        id: `DQ-29-all`,
        issueType: 'Data Inconsistency',
        category: 'Data Quality',
        sheetName: 'Multiple',
        severity: 'medium',
        condition: 'Same Porter ID maps to different names',
        description: `Porter IDs are mapped to multiple different names across the workbook.`,
        affectedRows: inconsistentPorterRows,
        affectedColumns: ['porter id', 'porter name'],
        totalAffectedRows: inconsistentPorterRows.length,
        remediationSuggestion: `Standardize the porter's name across all sheets.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    // FR-31: Statistical outliers per pool
    const outlierRows: AffectedRow[] = [];
    for (const [pool, items] of Array.from(poolTats.entries())) {
      const values = items.map(i => i.val);
      const outlierVals = detectOutliers(values, 3);
      
      if (outlierVals.length > 0) {
        for (const outVal of outlierVals) {
          const matchingItems = items.filter(i => i.val === outVal);
          for (const match of matchingItems) {
            outlierRows.push({
              rowNumber: match.row,
              columnName: 'tat (create to complete)',
              actualValue: `${outVal}s (Pool: ${pool})`
            });
          }
        }
      }
    }

    if (outlierRows.length > 0) {
      issues.push({
        id: `DQ-31-all`,
        issueType: 'Statistical Outlier',
        category: 'Data Quality',
        sheetName: wb.sheets.find(s => s.type === 'Request Details')?.sheetName || 'Request Details',
        severity: 'low',
        condition: 'TAT value exceeds 3 standard deviations',
        description: `TAT values are statistical outliers (>3 standard deviations from their pool mean).`,
        affectedRows: outlierRows,
        affectedColumns: ['tat (create to complete)', 'pool name'],
        totalAffectedRows: outlierRows.length,
        remediationSuggestion: `Review these requests for data entry errors or exceptional delays.`,
        remediationType: 'review',
        source: 'rule'
      });
    }

    return { issues };
  }
};
