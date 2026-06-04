import { describe, it, expect } from 'vitest';
import { porterPerformanceRules } from '../../../lib/validator/rules/porter-performance';
import { ParsedWorkbook } from '../../../lib/validator/types';

function createMockWorkbook(sheets: any[]): ParsedWorkbook {
  return {
    fileName: 'mock.xlsx',
    fileSize: 1000,
    sheets: sheets.map(s => ({
      sheetName: s.type,
      type: s.type,
      rowCount: s.data.length,
      colCount: Object.keys(s.data[0] || {}).length,
      data: s.data
    }))
  };
}

describe('Porter Performance Rules (FR-19 to FR-20)', () => {
  it('FR-19: Completed count per porter in Performance = count in Request Details', () => {
    const wb = createMockWorkbook([
      {
        type: 'Porter Performance',
        data: [
          { 'porter id': 'P1', completed: 2, 'total intime': '02:00:00', 'total time (accept to complete)': '01:30:00' }, // Matches
          { 'porter id': 'P2', completed: 3, 'total intime': '01:00:00', 'total time (accept to complete)': '01:30:00' }  // Mismatch (actual is 1)
        ]
      },
      {
        type: 'Request Details',
        data: [
          { 'porter id': 'P1', status: 'Completed' },
          { 'porter id': 'P1', status: 'Completed' },
          { 'porter id': 'P2', status: 'Completed' },
          { 'porter id': 'P2', status: 'Cancelled' }
        ]
      }
    ]);

    const { issues } = porterPerformanceRules.run(wb);
    const mismatchIssues = issues.filter(i => i.issueType === 'Data Mismatch Across Sheets' && i.description.includes('completed'));
    
    expect(mismatchIssues).toHaveLength(1);
    expect(mismatchIssues[0].severity).toBe('critical');
    expect(mismatchIssues[0].description).toContain('P2');
  });

  it('FR-20: Total Intime >= Total Time (Accept to Complete)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Porter Performance',
        data: [
          { 'porter id': 'P1', completed: 2, 'total intime': '02:00:00', 'total time (accept to complete)': '01:30:00' }, // Valid
          { 'porter id': 'P2', completed: 0, 'total intime': '01:00:00', 'total time (accept to complete)': '01:30:00' }  // Invalid
        ]
      },
      {
        type: 'Request Details',
        data: [] // just needs to exist
      }
    ]);

    const { issues } = porterPerformanceRules.run(wb);
    const issue = issues.find(i => i.issueType === 'Data Mismatch Across Sheets' && i.description.includes('intime'));
    
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('critical');
    expect(issue?.description).toContain('P2');
  });
});
