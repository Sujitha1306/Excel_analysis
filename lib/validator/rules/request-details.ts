import { RuleModule } from './types';
import { ParsedWorkbook, ValidationIssue } from '../types';
import { WorkbookMapping, SheetMapping, getColumnValue } from '../../ai/columnMapper';

function findActualColumnByConcept(concept: string, mapping: SheetMapping): string | undefined {
  if (!mapping || !mapping.columns) return undefined;
  return Object.entries(mapping.columns).find(([_, c]) => c === concept)?.[0];
}

function parseDuration(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

export const requestDetailsRules: RuleModule = {
  name: 'request-details-rules',
  run: (workbook: ParsedWorkbook, mapping: WorkbookMapping) => {
    const issues: ValidationIssue[] = [];

    for (const sheet of workbook.sheets) {
      const sheetMapping = mapping[sheet.sheetName];
      if (!sheetMapping) continue;

      const reqIdCol = findActualColumnByConcept('request_id', sheetMapping);
      const statusCol = findActualColumnByConcept('status', sheetMapping);
      const startCol = findActualColumnByConcept('start_time', sheetMapping);
      const endCol = findActualColumnByConcept('end_time', sheetMapping);
      const durationCol = findActualColumnByConcept('total_duration', sheetMapping);
      
      const createToAcceptCol = findActualColumnByConcept('create_to_accept', sheetMapping);
      const acceptToArriveCol = findActualColumnByConcept('accept_to_arrive', sheetMapping);
      const arriveToCompleteCol = findActualColumnByConcept('arrive_to_complete', sheetMapping);
      
      const reqIds = new Set<string>();

      sheet.data.forEach((row, i) => {
        const rowNum = (sheet.headerRowIndex || 0) + i + 2;
        const reqId = reqIdCol ? String(row[reqIdCol] || '').trim() : undefined;
        const status = statusCol ? String(row[statusCol] || '').trim().toLowerCase() : '';
        const start = startCol ? row[startCol] : null;
        const end = endCol ? row[endCol] : null;
        const duration = durationCol ? row[durationCol] : null;
        const parsedDuration = parseDuration(duration);

        // CRITICAL 6: Duplicate Request ID
        if (reqId && reqId !== '') {
          if (reqIds.has(reqId)) {
            issues.push({
              id: `dup-req-${reqId}-${rowNum}`,
              issueType: 'Duplicate Request ID',
              category: 'CRITICAL ERRORS',
              sheetName: sheet.sheetName,
              severity: 'critical',
              condition: 'Request IDs must be unique',
              description: `Request ID ${reqId} appears multiple times.`,
              affectedRows: [{ rowNumber: rowNum, columnName: reqIdCol!, actualValue: reqId, expectedValue: 'Unique ID', requestId: reqId }],
              affectedColumns: [reqIdCol!],
              totalAffectedRows: 1,
              remediationSuggestion: 'Remove or consolidate duplicate rows.',
              remediationType: 'manual',
              source: 'rule'
            });
          }
          reqIds.add(reqId);
        }

        const isCompleted = status.includes('complete');

        // CRITICAL 2: TAT/Duration Zero on Completed Request
        if (isCompleted && durationCol && (duration === null || duration === '' || parsedDuration === 0)) {
          issues.push({
            id: `zero-dur-${rowNum}`,
            issueType: 'TAT/Duration Zero on Completed Request',
            category: 'CRITICAL ERRORS',
            sheetName: sheet.sheetName,
            severity: 'critical',
            condition: 'Completed requests must have total_duration > 0',
            description: `Request is marked Completed but total duration is 0 or empty.`,
            affectedRows: [{ rowNumber: rowNum, columnName: durationCol, actualValue: duration, expectedValue: '> 0', requestId: reqId }],
            affectedColumns: [durationCol, statusCol!],
            totalAffectedRows: 1,
            remediationSuggestion: 'Check if timestamps were recorded properly.',
            remediationType: 'manual',
            source: 'rule'
          });
        }

        // CRITICAL 3: Negative Duration
        if (parsedDuration < 0) {
          issues.push({
            id: `neg-dur-${rowNum}`,
            issueType: 'Negative Duration',
            category: 'CRITICAL ERRORS',
            sheetName: sheet.sheetName,
            severity: 'critical',
            condition: 'Duration >= 0',
            description: `Duration is negative. End time might be before Start time.`,
            affectedRows: [{ rowNumber: rowNum, columnName: durationCol!, actualValue: parsedDuration, expectedValue: '>= 0', requestId: reqId }],
            affectedColumns: [durationCol!],
            totalAffectedRows: 1,
            remediationSuggestion: 'Correct the start and end timestamps.',
            remediationType: 'manual',
            source: 'rule'
          });
        }

        // CRITICAL 5: TAT Components Don't Sum to Total
        if (durationCol && createToAcceptCol && acceptToArriveCol && arriveToCompleteCol) {
          const p1 = parseDuration(row[createToAcceptCol]);
          const p2 = parseDuration(row[acceptToArriveCol]);
          const p3 = parseDuration(row[arriveToCompleteCol]);
          const sum = p1 + p2 + p3;
          // allow small float rounding differences
          if (Math.abs(sum - parsedDuration) > 1) {
            issues.push({
              id: `sum-dur-${rowNum}`,
              issueType: "TAT Components Don't Sum to Total",
              category: 'CRITICAL ERRORS',
              sheetName: sheet.sheetName,
              severity: 'critical',
              condition: 'Sum of components == total_duration',
              description: `Component times (${p1} + ${p2} + ${p3} = ${sum}) do not match total duration (${parsedDuration}).`,
              affectedRows: [{ rowNumber: rowNum, columnName: durationCol, actualValue: parsedDuration, expectedValue: String(sum), requestId: reqId }],
              affectedColumns: [durationCol, createToAcceptCol, acceptToArriveCol, arriveToCompleteCol],
              totalAffectedRows: 1,
              remediationSuggestion: 'Verify the individual TAT components.',
              remediationType: 'manual',
              source: 'rule'
            });
          }
        }

        // MEDIUM 1: Partial TAT with Completed Status
        // If completed, components should ideally be present if columns exist
        if (isCompleted && createToAcceptCol && (row[createToAcceptCol] === null || row[createToAcceptCol] === '')) {
           issues.push({
              id: `part-tat-${rowNum}`,
              issueType: 'Partial TAT with Completed Status',
              category: 'MEDIUM ERRORS',
              sheetName: sheet.sheetName,
              severity: 'medium',
              condition: 'Completed requests should have component TATs',
              description: `Request is Completed but missing component TAT (${createToAcceptCol}).`,
              affectedRows: [{ rowNumber: rowNum, columnName: createToAcceptCol, actualValue: 'Empty', expectedValue: 'Value > 0', requestId: reqId }],
              affectedColumns: [createToAcceptCol, statusCol!],
              totalAffectedRows: 1,
              remediationSuggestion: 'Ensure all stages of the request are tracked.',
              remediationType: 'manual',
              source: 'rule'
            });
        }

        // MEDIUM 2: Missing Completion Timestamp
        if (isCompleted && endCol && (end === null || end === '')) {
          issues.push({
            id: `miss-end-${rowNum}`,
            issueType: 'Missing Completion Timestamp',
            category: 'MEDIUM ERRORS',
            sheetName: sheet.sheetName,
            severity: 'medium',
            condition: 'Completed requests must have an end_time',
            description: `Request is Completed but missing completion timestamp.`,
            affectedRows: [{ rowNumber: rowNum, columnName: endCol, actualValue: 'Empty', expectedValue: 'Valid Date/Time', requestId: reqId }],
            affectedColumns: [endCol, statusCol!],
            totalAffectedRows: 1,
            remediationSuggestion: 'Add the missing completion timestamp.',
            remediationType: 'manual',
            source: 'rule'
          });
        }

        // MEDIUM 3: Invalid Status Value
        const validStatuses = ['completed', 'cancelled', 'rejected', 'waiting', 'open', 'assigned', 'accepted', 'arrived', 'started', 'pending'];
        if (statusCol && status !== '' && !validStatuses.some(s => status.includes(s))) {
          issues.push({
            id: `inv-stat-${rowNum}`,
            issueType: 'Invalid Status Value',
            category: 'MEDIUM ERRORS',
            sheetName: sheet.sheetName,
            severity: 'medium',
            condition: 'Status must be a recognized value',
            description: `Unrecognized status value: ${status}`,
            affectedRows: [{ rowNumber: rowNum, columnName: statusCol, actualValue: status, expectedValue: 'Completed/Cancelled/etc', requestId: reqId }],
            affectedColumns: [statusCol],
            totalAffectedRows: 1,
            remediationSuggestion: 'Standardize status values to accepted nomenclature.',
            remediationType: 'manual',
            source: 'rule'
          });
        }

      });
    }

    return { issues };
  }
};
