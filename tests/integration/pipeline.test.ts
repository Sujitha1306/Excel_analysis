import { describe, it, expect } from 'vitest';
import { runValidationPipeline } from '../../lib/validator/index';
import { ParsedWorkbook } from '../../lib/validator/types';
import { WorkbookMapping } from '../../lib/validator/mapping';

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
          { Date: '01-06-2026', 'Total Requests': 100, Completed: 80, Cancelled: 10, 'Total Duration': '00:15:00' }
        ]
      },
      {
        sheetName: 'Location Summary',
        type: 'Location Summary',
        rowCount: 2,
        colCount: 5,
        data: [
          { Location: 'ER', Requested: 50, Completed: 40, Cancelled: 5, Rejected: 5, Type: 'Source' },
          { Location: 'ICU', Requested: 40, Completed: 30, Cancelled: 5, Rejected: 5, Type: 'Destination' } // source vs destination mismatch
        ]
      },
      {
        sheetName: 'Pool Summary',
        type: 'Pool Summary',
        rowCount: 1,
        colCount: 6,
        data: [
          { 'Pool Name': 'Total', 'Total Requests': 100, Completed: 80, Cancelled: 10, Rejected: 10, Open: 0, 'Porter Count': 10 }
        ]
      },
      {
        sheetName: 'Request Details',
        type: 'Request Details',
        rowCount: 3,
        colCount: 15,
        data: [
          { 
            'Request ID': 'REQ-001', Status: 'Completed',
            'Start Time': '10:00:00', 'End Time': '10:15:00', Duration: '00:00:00'
          },
          { 
            'Request ID': 'REQ-001', Status: 'Completed',
            'Start Time': '11:00:00', 'End Time': '10:00:00', Duration: '00:10:00'
          },
          { 
            'Request ID': 'REQ-001', Status: 'Unknown',
            'Start Time': '12:00:00', 'End Time': '12:05:00', Duration: '00:05:00'
          }
        ]
      },
      {
        sheetName: 'Porter Performance',
        type: 'Porter Performance',
        rowCount: 3,
        colCount: 5,
        data: [
          { 'Porter ID': 'P01', 'Porter Name': 'salma', Completed: 1 },
          { 'Porter ID': 'P02', 'Porter Name': 'John', Completed: 0 },
          { 'Porter ID': 'P03', 'Porter Name': 'Mike', Completed: 1 }
        ]
      },
      {
        sheetName: 'Idle Summary',
        type: 'Idle Summary',
        rowCount: 3,
        colCount: 3,
        data: [
          { 'Porter ID': 'P01', 'Porter Name': 'salma', 'Total Idle Time': '07:45:00' },
          { 'Porter ID': 'P02', 'Porter Name': 'John', 'Total Idle Time': '08:00:00' },
          { 'Porter ID': 'P03', 'Porter Name': 'Mike', 'Total Idle Time': '07:55:00' }
        ]
      }
    ]
  };
}

function createWorkbookMapping(): WorkbookMapping {
  return {
    'Date Summary': {
      sheetType: 'date_summary',
      isCountableSheet: true,
      columns: {
        Date: 'start_time',
        'Total Requests': 'total_requests',
        Completed: 'completed_count',
        Cancelled: 'cancelled_count',
        'Total Duration': 'total_duration'
      }
    },
    'Location Summary': {
      sheetType: 'location_summary',
      isCountableSheet: true,
      columns: {
        Location: 'location',
        Requested: 'total_requests',
        Completed: 'completed_count',
        Cancelled: 'cancelled_count',
        Rejected: 'rejected_count',
        Type: 'row_type'
      }
    },
    'Pool Summary': {
      sheetType: 'pool_summary',
      isCountableSheet: true,
      columns: {
        'Pool Name': 'pool_name',
        'Total Requests': 'total_requests',
        Completed: 'completed_count',
        Cancelled: 'cancelled_count',
        Rejected: 'rejected_count',
        Open: 'open_count',
        'Porter Count': 'porter_count'
      }
    },
    'Request Details': {
      sheetType: 'request_details',
      isCountableSheet: false,
      columns: {
        'Request ID': 'request_id',
        Status: 'status',
        'Start Time': 'start_time',
        'End Time': 'end_time',
        Duration: 'total_duration'
      }
    },
    'Porter Performance': {
      sheetType: 'porter_performance',
      isCountableSheet: false,
      columns: {
        'Porter ID': 'porter_id',
        'Porter Name': 'porter_name'
      }
    },
    'Idle Summary': {
      sheetType: 'idle_summary',
      isCountableSheet: false,
      columns: {
        'Porter ID': 'porter_id',
        'Porter Name': 'porter_name'
      }
    }
  };
}

describe('Full Validation Pipeline Integration', () => {
  it('runs all rules and produces the correct ValidationReport shape', () => {
    const wb = createMockBlkMaxWorkbook();
    
    // Time the execution
    const start = performance.now();
    const report = runValidationPipeline(wb, createWorkbookMapping());
    const end = performance.now();
    
    expect(end - start).toBeLessThan(1000); // Should be very fast

    expect(report.totalIssues).toBeGreaterThanOrEqual(4);

    const hasCrossSheet = report.issues.some(i => i.issueType === 'Count Mismatch Across Sheets');
    expect(hasCrossSheet).toBe(true);

    const hasDuplicate = report.issues.some(i => i.issueType === 'Duplicate Request ID');
    expect(hasDuplicate).toBe(true);

    const hasZeroDuration = report.issues.some(i => i.issueType === 'TAT/Duration Zero on Completed Request');
    expect(hasZeroDuration).toBe(true);

    const hasInvalidStatus = report.issues.some(i => i.issueType === 'Invalid Status Value');
    expect(hasInvalidStatus).toBe(true);

    // Verify Quality Score is calculated and within expected range
    expect(report.qualityScore).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore).toBeLessThanOrEqual(100);
    
    // Verify properties
    expect(report.fileName).toBe('BLK_Max_Hospital-Porter_Request_Summary2026-06-01.xlsx');
    expect(report.sheetsAnalyzed.length).toBe(6);
    expect(report.validatedAt).toBeInstanceOf(Date);
  });
});
