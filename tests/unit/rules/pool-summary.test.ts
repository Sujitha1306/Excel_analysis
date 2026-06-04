import { describe, it, expect } from 'vitest';
import { poolSummaryRules } from '../../../lib/validator/rules/pool-summary';
import { ParsedWorkbook } from '../../../lib/validator/types';

function createMockWorkbook(data: any[]): ParsedWorkbook {
  return {
    fileName: 'mock.xlsx',
    fileSize: 1000,
    sheets: [{
      sheetName: 'Pool Summary',
      type: 'Pool Summary',
      rowCount: data.length,
      colCount: Object.keys(data[0] || {}).length,
      data: data
    }]
  };
}

describe('Pool Summary Rules (FR-22)', () => {
  it('FR-22: Completed + Cancelled + Open + Rejected = Total Requests', () => {
    const wb = createMockWorkbook([
      { 'pool name': 'Pool A', 'total requests': 20, completed: 15, cancelled: 2, open: 2, rejected: 1, 'porter count': 5 }, // Valid
      { 'pool name': 'Pool B', 'total requests': 20, completed: 15, cancelled: 2, open: 2, rejected: 2, 'porter count': 5 }  // Invalid (21 != 20)
    ]);

    const { issues } = poolSummaryRules.run(wb);
    
    expect(issues).toHaveLength(1);
    expect(issues[0].issueType).toBe('Formula Error');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].description).toContain('Pool B');
  });
});
