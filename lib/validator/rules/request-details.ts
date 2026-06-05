import { RuleModule } from './types';
import { ParsedWorkbook, ValidationIssue } from '../types';
import { WorkbookMapping, SheetMapping, getColumnValue } from '../../ai/columnMapper';
import { parseDuration, formatDuration } from '../../utils/time';

function findActualColumnByConcept(concept: string, mapping: SheetMapping): string | undefined {
  if (!mapping || !mapping.columns) return undefined;
  return Object.entries(mapping.columns).find(([_, c]) => c === concept)?.[0];
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
      
      const waitTimeCol = findActualColumnByConcept('wait_time', sheetMapping);
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
        const durationSeconds = parseDuration(duration);

        // CHECK A: TAT/Duration Zero on Completed Request
        if (status === 'completed' && durationSeconds === 0) {
          issues.push({
            id: `zero-dur-${rowNum}`,
            issueType: 'TAT/Duration Zero on Completed Request',
            category: 'CRITICAL ERRORS',
            sheetName: sheet.sheetName,
            severity: 'critical',
            condition: 'Completed requests must have total_duration > 0',
            description: `Request is marked Completed but total duration is zero. A completed request must have a positive time duration.`,
            affectedRows: [{ rowNumber: rowNum, columnName: durationCol!, actualValue: formatDuration(durationSeconds), expectedValue: '> 00:00:00', requestId: reqId }],
            affectedColumns: [durationCol!, statusCol!],
            totalAffectedRows: 1,
            remediationSuggestion: 'Check if timestamps were recorded properly.',
            remediationType: 'manual',
            source: 'rule'
          });
        }

        // CHECK B: Start/End time difference vs recorded duration
        if (start && end && durationCol) {
          const startDate = new Date(String(start));
          const endDate = new Date(String(end));
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const calculatedSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
            
            if (calculatedSeconds >= 0) {
              const diff = Math.abs(calculatedSeconds - durationSeconds);
              if (diff > 60) {
                issues.push({
                  id: `dur-mismatch-${rowNum}`,
                  issueType: 'Duration Mismatch',
                  category: 'CRITICAL ERRORS',
                  sheetName: sheet.sheetName,
                  severity: 'critical',
                  condition: 'Calculated duration must match recorded duration',
                  description: `The recorded duration does not match the difference between Start and End times. Calculated: ${formatDuration(calculatedSeconds)}, Recorded: ${formatDuration(durationSeconds)}`,
                  affectedRows: [{ rowNumber: rowNum, columnName: durationCol, actualValue: formatDuration(durationSeconds), expectedValue: formatDuration(calculatedSeconds), requestId: reqId }],
                  affectedColumns: [startCol!, endCol!, durationCol],
                  totalAffectedRows: 1,
                  remediationSuggestion: 'Verify the formula or logic used to calculate the recorded duration.',
                  remediationType: 'manual',
                  source: 'rule'
                });
              }
            }
          }
        }

        // CHECK D: Negative TAT (End time before Start time)
        if (start && end) {
          const startDate = new Date(String(start));
          const endDate = new Date(String(end));
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const calculatedSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
            
            if (calculatedSeconds < 0) {
              issues.push({
                id: `neg-tat-${rowNum}`,
                issueType: 'Negative TAT',
                category: 'CRITICAL ERRORS',
                sheetName: sheet.sheetName,
                severity: 'critical',
                condition: 'End time must be after Start time',
                description: 'End time is before Start time which is physically impossible.',
                affectedRows: [{ rowNumber: rowNum, columnName: startCol! + ' / ' + endCol!, actualValue: `Start: ${start} → End: ${end}`, expectedValue: 'End time must be after Start time', requestId: reqId }],
                affectedColumns: [startCol!, endCol!],
                totalAffectedRows: 1,
                remediationSuggestion: 'Correct the start and end timestamps.',
                remediationType: 'manual',
                source: 'rule'
              });
            }
          }
        }

        // CHECK C: TAT Components Don't Sum to Total
        if (durationCol) {
          const availableCols = [waitTimeCol, createToAcceptCol, acceptToArriveCol, arriveToCompleteCol].filter(Boolean) as string[];
          
          if (availableCols.length > 1) { // Need at least 2 components to make a sum meaningful
            const rawVals = availableCols.map(col => String(row[col] ?? '').trim());

            // Only validate sum if all available components actually have data
            if (rawVals.every(val => val !== '')) {
              const componentSum = rawVals.reduce((sum, val) => sum + parseDuration(val), 0);
              
              if (Math.abs(componentSum - durationSeconds) > 60) {
                issues.push({
                  id: `sum-dur-${rowNum}`,
                  issueType: "TAT Components Don't Sum to Total",
                  category: 'CRITICAL ERRORS',
                  sheetName: sheet.sheetName,
                  severity: 'critical',
                  condition: 'Sum of components == total_duration',
                  description: `The sum of TAT components (${availableCols.join(' + ')}) does not equal the total duration. Components sum to ${formatDuration(componentSum)} but total shows ${formatDuration(durationSeconds)}.`,
                  affectedRows: [{ rowNumber: rowNum, columnName: durationCol, actualValue: formatDuration(durationSeconds), expectedValue: formatDuration(componentSum), requestId: reqId }],
                  affectedColumns: [durationCol, ...availableCols],
                  totalAffectedRows: 1,
                  remediationSuggestion: 'Verify the individual TAT components.',
                  remediationType: 'manual',
                  source: 'rule'
                });
              }
            }
          }
        }

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

        // MEDIUM 1: Partial TAT with Completed Status
        // If completed, components should ideally be present if columns exist
        if (status === 'completed' && createToAcceptCol && (row[createToAcceptCol] === null || row[createToAcceptCol] === '')) {
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
        if (status === 'completed' && endCol && (end === null || end === '')) {
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
