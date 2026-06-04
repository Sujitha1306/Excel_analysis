import { describe, it, expect } from 'vitest';
import { requestDetailsRules } from '../../../lib/validator/rules/request-details';
import { ParsedWorkbook } from '../../../lib/validator/types';

function createMockWorkbook(data: any[]): ParsedWorkbook {
  return {
    fileName: 'mock.xlsx',
    fileSize: 1000,
    sheets: [{
      sheetName: 'Request Details',
      type: 'Request Details',
      rowCount: data.length,
      colCount: Object.keys(data[0] || {}).length,
      data: data
    }]
  };
}

describe('Request Details Rules (FR-13 to FR-18)', () => {
  it('FR-13: Status=Completed -> CompletedBy must not be blank', () => {
    const wb = createMockWorkbook([
      { requestid: 'R1', status: 'Completed', 'completed by': '' },
      { requestid: 'R2', status: 'Completed', 'completed by': 'John Doe' },
      { requestid: 'R3', status: 'Cancelled', 'completed by': '' }
    ]);

    const { issues } = requestDetailsRules.run(wb);
    const issue = issues.find(i => i.issueType === 'Missing Values');
    
    expect(issue).toBeDefined();
    expect(issue?.affectedRows.length).toBe(1); // Only R1 should be flagged
    expect(issue?.severity).toBe('critical');
    expect(issue?.affectedRows[0].rowNumber).toBe(0); // first row
  });

  it('FR-14: Status=Cancelled -> TAT fields must be blank/zero', () => {
    const wb = createMockWorkbook([
      { requestid: 'R1', status: 'Cancelled', 'tat (accept to complete)': '00:10:00', 'tat (create to complete)': '00:15:00' }, // Invalid non-zero TAT
      { requestid: 'R2', status: 'Cancelled', 'tat (accept to complete)': '00:00:00', 'tat (create to complete)': '00:15:00' }, // Valid
      { requestid: 'R3', status: 'Cancelled', 'tat (accept to complete)': '', 'tat (create to complete)': '00:05:00' } // Valid
    ]);

    const { issues } = requestDetailsRules.run(wb);
    const issue = issues.find(i => i.issueType === 'Invalid State');
    
    expect(issue).toBeDefined();
    expect(issue?.affectedRows.length).toBe(1); // Only R1
    expect(issue?.severity).toBe('medium');
  });

  it('FR-15: Duplicate requestid detection', () => {
    const wb = createMockWorkbook([
      { requestid: 'R1' },
      { requestid: 'R2' },
      { requestid: 'R1' }, // 2 instances -> valid co-assignment
      { requestid: 'R3' },
      { requestid: 'R3' },
      { requestid: 'R3' }, // 3 instances -> Critical
      { requestid: 'R4' },
      { requestid: 'R4' },
      { requestid: 'R4' },
      { requestid: 'R4' }  // 4 instances -> Critical
    ]);

    const { issues } = requestDetailsRules.run(wb);
    const dupIssues = issues.filter(i => i.issueType === 'Duplicate Records');
    
    // R1 should NOT be flagged. R3 and R4 should be flagged.
    expect(dupIssues).toHaveLength(2);
    
    const r3Issue = dupIssues.find(i => i.description.includes('R3'));
    expect(r3Issue).toBeDefined();
    expect(r3Issue?.severity).toBe('critical');
    expect(r3Issue?.affectedRows).toHaveLength(3);
    
    const r4Issue = dupIssues.find(i => i.description.includes('R4'));
    expect(r4Issue).toBeDefined();
    expect(r4Issue?.severity).toBe('critical');
    expect(r4Issue?.affectedRows).toHaveLength(4);
  });

  it('FR-16: Request time status values', () => {
    const wb = createMockWorkbook([
      { requestid: 'R1', status: 'Completed', 'request time status': 'Less than 3mins' }, // Valid
      { requestid: 'R2', status: 'Completed', 'request time status': 'More than 30mins' }, // Valid
      { requestid: 'R3', status: 'Cancelled', 'request time status': '' }, // Valid
      { requestid: 'R4', status: 'Completed', 'request time status': 'Between 3 and 30mins' }, // Invalid
      { requestid: 'R5', status: 'Completed', 'request time status': 'less than 3mins' } // Invalid casing
    ]);

    const { issues } = requestDetailsRules.run(wb);
    const statusIssues = issues.filter(i => i.issueType === 'Invalid Data');
    
    expect(statusIssues).toHaveLength(1);
    expect(statusIssues[0].severity).toBe('medium');
    expect(statusIssues[0].affectedRows).toHaveLength(2); // R4 and R5
  });

  it('FR-17: Start time < End time (time reversal)', () => {
    const wb = createMockWorkbook([
      { requestid: 'R1', 'start time': '10:00:00', 'end time': '10:15:00' }, // Valid
      { requestid: 'R2', 'start time': '10:30:00', 'end time': '10:15:00' }  // Invalid
    ]);

    const { issues } = requestDetailsRules.run(wb);
    const issue = issues.find(i => i.issueType === 'Invalid Date');
    
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('critical');
    expect(issue?.affectedRows).toHaveLength(1); // R2
  });

  it('FR-18: TAT(Accept->Complete) approx eq TAT(Accept->Arrive) + TAT(Arrive->Complete)', () => {
    const wb = createMockWorkbook([
      // 5 min + 10 min = 15 min (Valid)
      { requestid: 'R1', 'tat (accept to arrive)': '00:05:00', 'tat (arrive to complete)': '00:10:00', 'tat (accept to complete)': '00:15:00' },
      // 5 min + 10 min = 15 min 03 sec (Valid - within 5 sec tolerance)
      { requestid: 'R2', 'tat (accept to arrive)': '00:05:00', 'tat (arrive to complete)': '00:10:00', 'tat (accept to complete)': '00:15:03' },
      // 5 min + 10 min = 16 min (Invalid - out of 5 sec tolerance)
      { requestid: 'R3', 'tat (accept to arrive)': '00:05:00', 'tat (arrive to complete)': '00:10:00', 'tat (accept to complete)': '00:16:00' },
      // Blanks (should be ignored or handled gracefully)
      { requestid: 'R4', 'tat (accept to arrive)': '', 'tat (arrive to complete)': '', 'tat (accept to complete)': '' }
    ]);

    const { issues } = requestDetailsRules.run(wb);
    const issue = issues.find(i => i.issueType === 'Formula Error');
    
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('critical');
    expect(issue?.affectedRows).toHaveLength(1); // Only R3
  });
});
