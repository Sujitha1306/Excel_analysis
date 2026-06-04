import { describe, it, expect } from 'vitest';
import { locationSummaryRules } from '../../../lib/validator/rules/location-summary';
import { ParsedWorkbook } from '../../../lib/validator/types';

function createMockWorkbook(data: any[]): ParsedWorkbook {
  return {
    fileName: 'mock.xlsx',
    fileSize: 1000,
    sheets: [{
      sheetName: 'Location Summary',
      type: 'Location Summary',
      rowCount: data.length,
      colCount: Object.keys(data[0] || {}).length,
      data: data
    }]
  };
}

describe('Location Summary Rules (FR-21)', () => {
  it('FR-21: Completed + Rejected + Cancelled = Requested', () => {
    const wb = createMockWorkbook([
      { location: 'ER', requested: 10, completed: 8, rejected: 1, cancelled: 1 }, // Valid
      { location: 'ICU', requested: 10, completed: 8, rejected: 1, cancelled: 2 } // Invalid (11 != 10)
    ]);

    const { issues } = locationSummaryRules.run(wb);
    
    expect(issues).toHaveLength(1);
    expect(issues[0].issueType).toBe('Formula Error');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].description).toContain('ICU');
  });
});
