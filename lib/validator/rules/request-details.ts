import { RuleModule } from './types';
import { ParsedWorkbook, ParsedSheet, ValidationIssue, AffectedRow } from '../types';
import { parseDuration, durationDiffSeconds } from '../../utils/time';
import { columnGuard } from '../utils';

function getSheet(wb: ParsedWorkbook, type: string): ParsedSheet | undefined {
  return wb.sheets.find(s => s.type === type);
}

export const requestDetailsRules: RuleModule = {
  name: 'request-details-rules',
  
  run: (wb: ParsedWorkbook) => {
    const issues: ValidationIssue[] = [];
    
    const requestDetails = getSheet(wb, 'Request Details');
    if (!requestDetails) return { issues };

    // We no longer rely on columnGuard for issues, as FR-24 handles missing required fields centrally.
    // However, if we wanted to enforce it here, we would group it.
    // But data-quality.ts already checks required fields globally.

    const seenRequestIds = new Map<string, { row: number, id: string }[]>(); // map of requestid to row indices
    
    // Grouping collections
    const missingCompletedBy: AffectedRow[] = [];
    const invalidCancelledTat: AffectedRow[] = [];
    const invalidRequestStatus: AffectedRow[] = [];
    const timeReversal: AffectedRow[] = [];
    const tatMismatch: AffectedRow[] = [];
    const zeroCompletedTat: AffectedRow[] = [];
    const negativeRows: AffectedRow[] = [];
    const wrongDurationRows: AffectedRow[] = [];
    const fixedZeroRows: AffectedRow[] = [];

    const zeroDurationVals = ['00:00:00', '0:00:00', '00:00', '0'];
    const tatFields = [
      'tat (assigned to complete)',
      'tat (accept to arrive)',
      'tat (arrive to complete)',
      'tat (accept to complete)'
    ];

    requestDetails.data.forEach((row, rowIndex) => {
      const displayRow = rowIndex + 2;
      const status = String(row['status'] || '').trim();
      const requestId = String(row['requestid'] || '').trim();

      // FR-15: Track Request IDs for duplication detection
      if (requestId) {
        if (!seenRequestIds.has(requestId)) seenRequestIds.set(requestId, []);
        seenRequestIds.get(requestId)!.push({ row: displayRow, id: requestId });
      }

      // FR-13: Status=Completed -> CompletedBy must not be blank
      if (status.toLowerCase() === 'completed') {
        const completedBy = String(row['completed by'] || '').trim();
        if (!completedBy) {
          missingCompletedBy.push({
            rowNumber: displayRow,
            columnName: 'completed by',
            actualValue: completedBy,
            expectedValue: 'Non-empty name'
          });
        }

        // FR-32: Completed requests with 00:00:00 TAT
        const allZero = tatFields.every(field => {
          const val = String(row[field] ?? '').trim();
          return val === '' || zeroDurationVals.includes(val);
        });
        
        if (allZero) {
          zeroCompletedTat.push({
            rowNumber: displayRow,
            columnName: 'TAT Fields',
            actualValue: '00:00:00 across all TAT fields',
            expectedValue: 'Non-zero TAT for completed request'
          });
        }
      }

      // FR-14: Status=Cancelled -> TAT fields must be blank/zero
      if (status.toLowerCase() === 'cancelled') {
        const tatFields = ['tat (accept to arrive)', 'tat (arrive to complete)', 'tat (accept to complete)', 'tat (assigned to complete)'];
        let hasInvalidTat = false;
        let invalidVal = '';
        
        for (const field of tatFields) {
          const val = row[field];
          if (val && parseDuration(val) > 0) {
            hasInvalidTat = true;
            invalidVal = `${field}=${val}`;
            break;
          }
        }

        if (hasInvalidTat) {
          invalidCancelledTat.push({
            rowNumber: displayRow,
            columnName: 'tat fields',
            actualValue: invalidVal,
            expectedValue: 'Zero or empty'
          });
        }
      }

      // FR-16: Request time status values
      const requestTimeStatus = row['request time status'];
      if (requestTimeStatus !== undefined && requestTimeStatus !== null) {
        const val = String(requestTimeStatus);
        if (val !== '' && val !== 'Less than 3mins' && val !== 'More than 30mins') {
          invalidRequestStatus.push({
            rowNumber: displayRow,
            columnName: 'request time status',
            actualValue: val,
            expectedValue: 'Less than 3mins OR More than 30mins'
          });
        }
      }

      // CHECK A — Negative TAT (End time before Start time)
      const startTime = String(row['start time'] || '').trim();
      const endTime = String(row['end time'] || '').trim();
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        // Use our parseDuration for timeReversal if timestamps are times, or just use the Date objects if they are valid dates
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const durationSeconds = (end.getTime() - start.getTime()) / 1000;
          if (durationSeconds < 0) {
            negativeRows.push({
              rowNumber: displayRow,
              columnName: 'start time / end time',
              actualValue: `Start: ${startTime} → End: ${endTime}`,
              expectedValue: 'End time must be after Start time'
            });
          }
          
          // CHECK B — Recorded duration does not match calculated duration
          const rawDurationField = 'duration(create to complete)' in row ? row['duration(create to complete)'] : row['tat (create to complete)'];
          if (rawDurationField) {
            const calculatedSeconds = Math.abs(durationSeconds);
            const recordedSeconds = parseDuration(String(rawDurationField));
            
            const diff = Math.abs(calculatedSeconds - recordedSeconds);
            if (diff > 60) {
              wrongDurationRows.push({
                rowNumber: displayRow,
                columnName: 'Duration(Create to Complete)',
                actualValue: String(rawDurationField),
                expectedValue: `${Math.floor(calculatedSeconds/3600)}:${Math.floor((calculatedSeconds%3600)/60)}:${calculatedSeconds%60}`
              });
            }
          }
        } else if (parseDuration(startTime) > parseDuration(endTime)) {
          timeReversal.push({
            rowNumber: displayRow,
            columnName: 'start time / end time',
            actualValue: `${startTime} -> ${endTime}`,
            expectedValue: `Start time before End time`
          });
        }
      }

      // CHECK C — TAT fixed to zero on non-cancelled completed requests
      if (status.toLowerCase() === 'completed') {
        const rawDurationField = 'duration(create to complete)' in row ? row['duration(create to complete)'] : row['tat (create to complete)'];
        const totalDuration = parseDuration(String(rawDurationField ?? ''));
        if (totalDuration > 0) {
          const zeroTatFields = tatFields.filter(field => {
            const val = String(row[field] ?? '').trim();
            return val === '' || zeroDurationVals.includes(val);
          });
          
          if (zeroTatFields.length > 0) {
            fixedZeroRows.push({
              rowNumber: displayRow,
              columnName: zeroTatFields.join(', '),
              actualValue: '00:00:00',
              expectedValue: 'Non-zero value (work was performed)'
            });
          }
        }
      }

      // FR-18: TAT(Accept->Complete) approx eq TAT(Accept->Arrive) + TAT(Arrive->Complete)
      const tatAcceptToArrive = row['tat (accept to arrive)'];
      const tatArriveToComplete = row['tat (arrive to complete)'];
      const tatAcceptToComplete = row['tat (accept to complete)'];
      
      if (tatAcceptToArrive && tatArriveToComplete && tatAcceptToComplete) {
        const sumParts = parseDuration(tatAcceptToArrive) + parseDuration(tatArriveToComplete);
        const total = parseDuration(tatAcceptToComplete);
        
        if (sumParts > 0 && total > 0 && Math.abs(sumParts - total) > 5) {
          tatMismatch.push({
            rowNumber: displayRow,
            columnName: 'tat (accept to complete)',
            actualValue: `${tatAcceptToArrive} + ${tatArriveToComplete} != ${tatAcceptToComplete}`,
            expectedValue: `Values must sum correctly`
          });
        }
      }
    });

    // Create Grouped Issues

    if (missingCompletedBy.length > 0) {
      issues.push({
        id: `RD-13-all`,
        issueType: 'Missing Values',
        category: 'Data Completeness',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'Completed requests must have CompletedBy',
        description: `Requests are marked as Completed but 'Completed By' is blank.`,
        affectedRows: missingCompletedBy,
        affectedColumns: ['completed by', 'status'],
        totalAffectedRows: missingCompletedBy.length,
        remediationSuggestion: `Provide the name of the porter who completed these requests.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    if (invalidCancelledTat.length > 0) {
      issues.push({
        id: `RD-14-all`,
        issueType: 'Invalid State',
        category: 'Logic Integrity',
        sheetName: requestDetails.sheetName,
        severity: 'medium',
        condition: 'Cancelled requests must have zero TAT',
        description: `Requests are Cancelled but contain non-zero TAT values.`,
        affectedRows: invalidCancelledTat,
        affectedColumns: ['status', 'tat fields'],
        totalAffectedRows: invalidCancelledTat.length,
        remediationSuggestion: `Clear TAT values for cancelled requests.`,
        remediationType: 'auto',
        source: 'rule'
      });
    }

    if (invalidRequestStatus.length > 0) {
      issues.push({
        id: `RD-16-all`,
        issueType: 'Invalid Data',
        category: 'Data Quality',
        sheetName: requestDetails.sheetName,
        severity: 'medium',
        condition: 'Status must match allowed values',
        description: `Invalid Request Time Status values found. Must be 'Less than 3mins' or 'More than 30mins'.`,
        affectedRows: invalidRequestStatus,
        affectedColumns: ['request time status'],
        totalAffectedRows: invalidRequestStatus.length,
        remediationSuggestion: `Standardize to accepted status values.`,
        remediationType: 'auto',
        source: 'rule'
      });
    }

    if (timeReversal.length > 0) {
      issues.push({
        id: `RD-17-all`,
        issueType: 'Invalid Date',
        category: 'Logic Integrity',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'Start time must be before End time',
        description: `Start time is after End time for these requests.`,
        affectedRows: timeReversal,
        affectedColumns: ['start time', 'end time'],
        totalAffectedRows: timeReversal.length,
        remediationSuggestion: `Verify the timestamps. If spanning midnight, ensure dates are attached.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    if (tatMismatch.length > 0) {
      issues.push({
        id: `RD-18-all`,
        issueType: 'Formula Error',
        category: 'Logic Integrity',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'TAT components must sum to total TAT',
        description: `TAT Arithmetic mismatch: Accept->Arrive + Arrive->Complete != Accept->Complete.`,
        affectedRows: tatMismatch,
        affectedColumns: ['tat (accept to arrive)', 'tat (arrive to complete)', 'tat (accept to complete)'],
        totalAffectedRows: tatMismatch.length,
        remediationSuggestion: `Review the component TATs to correct the total TAT.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    if (zeroCompletedTat.length > 0) {
      issues.push({
        id: `RD-32-all`,
        issueType: 'Invalid Data',
        category: 'TAT Validation',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'Completed request must have non-zero TAT',
        description: `Requests are marked as Completed but have 00:00:00 or empty values across all TAT fields.`,
        affectedRows: zeroCompletedTat,
        affectedColumns: ['status', ...tatFields],
        totalAffectedRows: zeroCompletedTat.length,
        remediationSuggestion: `Verify the timestamps. Work completed instantly is likely a data entry error.`,
        remediationType: 'review',
        source: 'rule'
      });
    }

    if (negativeRows.length > 0) {
      issues.push({
        id: `RD-NEGTAT-${Date.now()}`,
        issueType: 'Negative Duration',
        category: 'TAT Validation',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'End time must be after Start time',
        description: `End time is before Start time.`,
        affectedRows: negativeRows,
        affectedColumns: ['start time', 'end time'],
        totalAffectedRows: negativeRows.length,
        remediationSuggestion: `Verify the timestamps.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    if (wrongDurationRows.length > 0) {
      issues.push({
        id: `RD-WRONGDUR-${Date.now()}`,
        issueType: 'Incorrect Duration',
        category: 'TAT Validation',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'Recorded duration must match calculated duration from timestamps',
        description: `The recorded duration does not match the difference between Start time and End time.`,
        affectedRows: wrongDurationRows,
        affectedColumns: ['start time', 'end time', 'duration(create to complete)'],
        totalAffectedRows: wrongDurationRows.length,
        remediationSuggestion: `Check how the duration was calculated.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    if (fixedZeroRows.length > 0) {
      issues.push({
        id: `RD-ZEROTAT-${Date.now()}`,
        issueType: 'Suspicious Zero TAT',
        category: 'TAT Validation',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'TAT components must not be exactly zero if work was done',
        description: `Work was performed (Total Duration > 0) but some TAT fields are exactly 00:00:00.`,
        affectedRows: fixedZeroRows,
        affectedColumns: ['tat fields'],
        totalAffectedRows: fixedZeroRows.length,
        remediationSuggestion: `Review these requests as porters may not be properly recording status changes.`,
        remediationType: 'review',
        source: 'rule'
      });
    }

    // Process FR-15 Duplicates
    const duplicateRows: AffectedRow[] = [];
    for (const [reqId, occurrences] of Array.from(seenRequestIds.entries())) {
      if (occurrences.length >= 3) {
        occurrences.forEach(occ => {
          duplicateRows.push({
            rowNumber: occ.row,
            columnName: 'requestid',
            actualValue: occ.id,
            expectedValue: 'Appears max 2 times'
          });
        });
      }
    }

    if (duplicateRows.length > 0) {
      issues.push({
        id: `RD-15-all`,
        issueType: 'Duplicate Records',
        category: 'Data Quality',
        sheetName: requestDetails.sheetName,
        severity: 'critical',
        condition: 'RequestID must not appear 3 or more times',
        description: `Request IDs appear 3 or more times. A maximum of 2 assignments per request is allowed.`,
        affectedRows: duplicateRows,
        affectedColumns: ['requestid'],
        totalAffectedRows: duplicateRows.length,
        remediationSuggestion: `Remove or merge duplicate request entries.`,
        remediationType: 'manual',
        source: 'rule'
      });
    }

    return { issues };
  }
};
