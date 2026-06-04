import { describe, it, expect } from 'vitest';
import { runValidationPipeline } from '../../lib/validator/index';
import { ParsedWorkbook } from '../../lib/validator/types';

function createMockBlkMaxWorkbook(): ParsedWorkbook {
  return {
    fileName: 'BLK_Max_Hospital-Porter_Request_Summary2026-06-01.xlsx',
    fileSize: 50000,
    sheets: [
      {
        sheetName: 'Date Summary',
        type: 'Date Summary',
        rowCount: 1,
        colCount: 5,
        data: [
          { date: '01-06-2026', 'total requests': 100, completed: 80, cancelled: 10, 'tat (create to complete)': '00:15:00' }
        ]
      },
      {
        sheetName: 'Location Summary',
        type: 'Location Summary',
        rowCount: 2,
        colCount: 5,
        data: [
          { location: 'ER', requested: 50, completed: 40, cancelled: 5, rejected: 5 },
          { location: 'ICU', requested: 40, completed: 30, cancelled: 5, rejected: 5 } // requested sum is 90 != 100 (FR-06 mismatch)
        ]
      },
      {
        sheetName: 'Pool Summary',
        type: 'Pool Summary',
        rowCount: 1,
        colCount: 6,
        data: [
          { 'pool name': 'Total', 'total requests': 100, completed: 80, cancelled: 10, rejected: 10, open: 0, 'porter count': 10 }
        ]
      },
      {
        sheetName: 'Request Details',
        type: 'Request Details',
        rowCount: 3,
        colCount: 15,
        data: [
          // "salma " whitespace issue (FR-26)
          { 
            requestid: 'REQ-001', 'porter id': 'P01', 'porter name': 'salma ', status: 'Completed', 
            'pool name': 'ER Pool', 'request time status': 'Less than 3mins', 'completed by': 'salma ',
            'start time': '10:00:00', 'end time': '10:15:00',
            'tat (accept to arrive)': '00:05:00', 'tat (arrive to complete)': '00:10:00', 'tat (accept to complete)': '00:15:00', 'tat (create to complete)': '00:15:00'
          },
          // Cancelled with non-zero TAT (FR-14)
          { 
            requestid: 'REQ-002', 'porter id': 'P02', 'porter name': 'John', status: 'Cancelled', 
            'pool name': 'ER Pool', 'request time status': 'More than 30mins', 'completed by': '',
            'start time': '10:20:00', 'end time': '11:00:00',
            'tat (accept to arrive)': '00:10:00', 'tat (arrive to complete)': '00:00:00', 'tat (accept to complete)': '00:10:00', 'tat (create to complete)': '00:40:00'
          },
          // Duplicate Request ID (FR-15)
          { 
            requestid: 'REQ-001', 'porter id': 'P03', 'porter name': 'Mike', status: 'Completed', 
            'pool name': 'ICU Pool', 'request time status': 'Less than 3mins', 'completed by': 'Mike',
            'start time': '12:00:00', 'end time': '12:05:00',
            'tat (accept to arrive)': '00:02:00', 'tat (arrive to complete)': '00:03:00', 'tat (accept to complete)': '00:05:00', 'tat (create to complete)': '00:05:00'
          }
        ]
      },
      {
        sheetName: 'Porter Performance',
        type: 'Porter Performance',
        rowCount: 3,
        colCount: 5,
        data: [
          { 'porter id': 'P01', 'porter name': 'salma', completed: 1, 'total intime': '08:00:00', 'total time (accept to complete)': '00:15:00' },
          { 'porter id': 'P02', 'porter name': 'John', completed: 0, 'total intime': '08:00:00', 'total time (accept to complete)': '00:00:00' },
          { 'porter id': 'P03', 'porter name': 'Mike', completed: 1, 'total intime': '08:00:00', 'total time (accept to complete)': '00:05:00' }
        ]
      },
      {
        sheetName: 'Idle Summary',
        type: 'Idle Summary',
        rowCount: 3,
        colCount: 3,
        data: [
          { 'porter id': 'P01', 'porter name': 'salma', 'total idle time': '07:45:00' },
          { 'porter id': 'P02', 'porter name': 'John', 'total idle time': '08:00:00' },
          { 'porter id': 'P03', 'porter name': 'Mike', 'total idle time': '07:55:00' }
        ]
      }
    ]
  };
}

describe('Full Validation Pipeline Integration', () => {
  it('runs all rules and produces the correct ValidationReport shape', () => {
    const wb = createMockBlkMaxWorkbook();
    
    // Time the execution
    const start = performance.now();
    const report = runValidationPipeline(wb);
    const end = performance.now();
    
    expect(end - start).toBeLessThan(1000); // Should be very fast

    // Expected Issues:
    // 1. Cross Sheet (FR-06): Date vs Location sums (Critical)
    // 2. Whitespace (FR-26): "salma " (Medium) x 2 (name and completed by)
    // 3. Cancelled TAT (FR-14): REQ-002 has 10m TAT (Medium)
    // 4. Duplicate ID (FR-15): REQ-001 (Critical) x 2 rows
    // 5. FR-29: "salma " vs "salma" mismatch across sheets (Medium)
    
    expect(report.totalIssues).toBeGreaterThanOrEqual(5);

    const hasCrossSheet = report.issues.some(i => i.issueType === 'cross_sheet_mismatch');
    expect(hasCrossSheet).toBe(true);

    const hasWhitespace = report.issues.some(i => i.issueType === 'whitespace_detected' && i.affectedRows[0].actualValue === 'salma ');
    expect(hasWhitespace).toBe(true);

    const hasCancelledTat = report.issues.some(i => i.issueType === 'invalid_cancelled_tat');
    expect(hasCancelledTat).toBe(true);

    // Verify Quality Score is calculated and within expected range 40-80
    expect(report.qualityScore).toBeGreaterThanOrEqual(40);
    expect(report.qualityScore).toBeLessThanOrEqual(80);
    
    // Verify properties
    expect(report.fileName).toBe('BLK_Max_Hospital-Porter_Request_Summary2026-06-01.xlsx');
    expect(report.sheetsAnalyzed.length).toBe(6);
    expect(report.validatedAt).toBeInstanceOf(Date);
  });
});
