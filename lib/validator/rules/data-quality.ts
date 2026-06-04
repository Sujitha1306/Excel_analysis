import { RuleModule } from './types';
import { ParsedWorkbook, ValidationIssue } from '../types';
import { WorkbookMapping, SheetMapping } from '../../ai/columnMapper';

function findActualColumnByConcept(concept: string, mapping: SheetMapping): string | undefined {
  if (!mapping || !mapping.columns) return undefined;
  return Object.entries(mapping.columns).find(([_, c]) => c === concept)?.[0];
}

function parseDuration(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

export const dataQualityRules: RuleModule = {
  name: 'data-quality-rules',
  run: (workbook: ParsedWorkbook, mapping: WorkbookMapping) => {
    const issues: ValidationIssue[] = [];

    // Porter ID to Names map to check for discrepancies
    const porterIdToNames = new Map<string, Set<string>>();

    for (const sheet of workbook.sheets) {
      const sheetMapping = mapping[sheet.sheetName];
      if (!sheetMapping) continue;

      const reqIdCol = findActualColumnByConcept('request_id', sheetMapping);
      const porterNameCol = findActualColumnByConcept('porter_name', sheetMapping);
      const porterIdCol = findActualColumnByConcept('porter_id', sheetMapping);
      const poolNameCol = findActualColumnByConcept('pool_name', sheetMapping);
      const locationCol = findActualColumnByConcept('location', sheetMapping);
      const durationCol = findActualColumnByConcept('total_duration', sheetMapping);

      const durations: { rowNum: number, reqId?: string, val: number }[] = [];

      sheet.data.forEach((row, i) => {
        const rowNum = (sheet.headerRowIndex || 0) + i + 2;
        const reqId = reqIdCol ? String(row[reqIdCol] || '').trim() : undefined;
        
        const rawPorterName = porterNameCol ? String(row[porterNameCol] || '') : '';
        const porterName = rawPorterName.trim();
        const porterId = porterIdCol ? String(row[porterIdCol] || '').trim() : '';
        
        const rawPoolName = poolNameCol ? String(row[poolNameCol] || '') : '';
        const poolName = rawPoolName.trim();

        const location = locationCol ? String(row[locationCol] || '').trim() : '';

        // LOW 1: Whitespace in Name Fields
        if (porterNameCol && rawPorterName !== porterName && rawPorterName.length > 0) {
          issues.push({
            id: `ws-porter-${rowNum}`,
            issueType: 'Whitespace in Name Fields',
            category: 'LOW ERRORS',
            sheetName: sheet.sheetName,
            severity: 'low',
            condition: 'No leading/trailing whitespace in names',
            description: `Porter name has leading or trailing whitespace.`,
            affectedRows: [{ rowNumber: rowNum, columnName: porterNameCol, actualValue: `"${rawPorterName}"`, expectedValue: `"${porterName}"`, requestId: reqId }],
            affectedColumns: [porterNameCol],
            totalAffectedRows: 1,
            remediationSuggestion: 'Trim whitespace from the porter name.',
            remediationType: 'auto',
            source: 'rule'
          });
        }
        if (poolNameCol && rawPoolName !== poolName && rawPoolName.length > 0) {
          issues.push({
            id: `ws-pool-${rowNum}`,
            issueType: 'Whitespace in Name Fields',
            category: 'LOW ERRORS',
            sheetName: sheet.sheetName,
            severity: 'low',
            condition: 'No leading/trailing whitespace in names',
            description: `Pool name has leading or trailing whitespace.`,
            affectedRows: [{ rowNumber: rowNum, columnName: poolNameCol, actualValue: `"${rawPoolName}"`, expectedValue: `"${poolName}"`, requestId: reqId }],
            affectedColumns: [poolNameCol],
            totalAffectedRows: 1,
            remediationSuggestion: 'Trim whitespace from the pool name.',
            remediationType: 'auto',
            source: 'rule'
          });
        }

        // LOW 2: Missing Required Fields (assume Location or Pool missing is bad if request has ID)
        if (reqId && reqId !== '') {
          if (locationCol && location === '') {
            issues.push({
              id: `miss-loc-${rowNum}`,
              issueType: 'Missing Required Fields',
              category: 'LOW ERRORS',
              sheetName: sheet.sheetName,
              severity: 'low',
              condition: 'Location should be present',
              description: `Request is missing Location data.`,
              affectedRows: [{ rowNumber: rowNum, columnName: locationCol, actualValue: 'Empty', expectedValue: 'Valid Location', requestId: reqId }],
              affectedColumns: [locationCol],
              totalAffectedRows: 1,
              remediationSuggestion: 'Add the missing location.',
              remediationType: 'manual',
              source: 'rule'
            });
          }
          if (poolNameCol && poolName === '') {
            issues.push({
              id: `miss-pool-${rowNum}`,
              issueType: 'Missing Required Fields',
              category: 'LOW ERRORS',
              sheetName: sheet.sheetName,
              severity: 'low',
              condition: 'Pool should be present',
              description: `Request is missing Pool data.`,
              affectedRows: [{ rowNumber: rowNum, columnName: poolNameCol, actualValue: 'Empty', expectedValue: 'Valid Pool Name', requestId: reqId }],
              affectedColumns: [poolNameCol],
              totalAffectedRows: 1,
              remediationSuggestion: 'Add the missing pool name.',
              remediationType: 'manual',
              source: 'rule'
            });
          }
        }

        // Record for LOW 3 (Porter ID to Names)
        if (porterId !== '' && porterName !== '') {
          if (!porterIdToNames.has(porterId)) {
            porterIdToNames.set(porterId, new Set());
          }
          porterIdToNames.get(porterId)!.add(porterName);
        }

        // Record for LOW 5 (Statistical Outlier)
        if (durationCol) {
          const val = parseDuration(row[durationCol]);
          if (val > 0) {
            durations.push({ rowNum, reqId, val });
          }
        }
      });

      // LOW 4: Ghost Columns
      // Look for empty headers or '__EMPTY' headers in normalized headers
      if (sheet.headers) {
        sheet.headers.forEach((header, i) => {
          if (header === '' || header.includes('__empty')) {
            issues.push({
              id: `ghost-col-${i}`,
              issueType: 'Ghost Columns',
              category: 'LOW ERRORS',
              sheetName: sheet.sheetName,
              severity: 'low',
              condition: 'All columns should have valid headers',
              description: `Found ghost column with no valid header at index ${i}.`,
              affectedRows: [{ rowNumber: 'Summary level', columnName: header || `Column ${i+1}`, actualValue: 'Empty Header', expectedValue: 'Valid Header Name' }],
              affectedColumns: [header || `Column ${i+1}`],
              totalAffectedRows: sheet.rowCount,
              remediationSuggestion: 'Remove empty columns from the sheet.',
              remediationType: 'manual',
              source: 'rule'
            });
          }
        });
      }

      // LOW 5: Statistical TAT Outlier
      if (durations.length > 5) {
        const sum = durations.reduce((a, b) => a + b.val, 0);
        const mean = sum / durations.length;
        const squareDiffs = durations.map(d => Math.pow(d.val - mean, 2));
        const variance = squareDiffs.reduce((a, b) => a + b, 0) / durations.length;
        const stdDev = Math.sqrt(variance);

        const outlierThreshold = mean + (3 * stdDev);
        for (const d of durations) {
          if (d.val > outlierThreshold) {
            issues.push({
              id: `outlier-${d.rowNum}`,
              issueType: 'Statistical TAT Outlier',
              category: 'LOW ERRORS',
              sheetName: sheet.sheetName,
              severity: 'low',
              condition: 'Duration within 3 std devs of mean',
              description: `Duration (${d.val}) is > 3 standard deviations above the mean (${mean.toFixed(2)}).`,
              affectedRows: [{ rowNumber: d.rowNum, columnName: durationCol!, actualValue: d.val, expectedValue: `<= ${outlierThreshold.toFixed(2)}`, requestId: d.reqId }],
              affectedColumns: [durationCol!],
              totalAffectedRows: 1,
              remediationSuggestion: 'Review this request for unusual delays.',
              remediationType: 'review',
              source: 'rule'
            });
          }
        }
      }
    }

    // Process LOW 3
    Array.from(porterIdToNames.entries()).forEach(([porterId, names]) => {
      if (names.size > 1) {
        issues.push({
          id: `porter-map-${porterId}`,
          issueType: 'Porter ID Maps to Different Names',
          category: 'LOW ERRORS',
          sheetName: 'Multiple',
          severity: 'low',
          condition: 'One ID = One Name',
          description: `Porter ID ${porterId} maps to multiple names: ${Array.from(names).join(', ')}.`,
          affectedRows: [{ rowNumber: 'Summary level', columnName: 'Porter ID/Name', actualValue: Array.from(names).join(', '), expectedValue: 'Single Name' }],
          affectedColumns: ['Porter ID/Name'],
          totalAffectedRows: 1,
          remediationSuggestion: 'Consolidate the porter names for this ID.',
          remediationType: 'manual',
          source: 'rule'
        });
      }
    });

    return { issues };
  }
};
