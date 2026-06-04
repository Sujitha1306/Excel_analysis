import { describe, it, expect } from 'vitest';
import { dataQualityRules } from '../../../lib/validator/rules/data-quality';
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

describe('Data Quality Rules (FR-24 to FR-32)', () => {
  it('FR-24: Detects blank required fields', () => {
    const wb = createMockWorkbook([
      {
        type: 'Request Details',
        data: [
          { 'requestid': 'R1', 'porter name': 'John' }, // Valid (mostly)
          { 'requestid': '', 'porter name': '' } // Missing ID and Name
        ]
      }
    ]);

    const { issues } = dataQualityRules.run(wb);
    const blanks = issues.filter(i => i.issueType === 'Missing Values');
    expect(blanks.length).toBeGreaterThan(0);
    expect(blanks[0].severity).toBe('medium');
  });

  it('FR-25 & FR-26: Detects whitespace-only and leading/trailing whitespace (salma )', () => {
    const wb = createMockWorkbook([
      {
        type: 'Request Details',
        data: [
          { 'porter name': '   ' }, // FR-25: whitespace only
          { 'porter name': 'salma ' } // FR-26: trailing whitespace
        ]
      }
    ]);

    const { issues } = dataQualityRules.run(wb);
    
    const onlySpace = issues.find(i => i.issueType === 'Whitespace Issue' && i.affectedRows[0].actualValue === '"   "');
    expect(onlySpace).toBeDefined();

    const trailing = issues.find(i => i.issueType === 'Whitespace Issue' && i.affectedRows[0].actualValue === 'salma ');
    expect(trailing).toBeDefined();
    expect(trailing?.remediationSuggestion).toContain('salma'); // Should suggest trimmed version
    expect(trailing?.remediationType).toBe('auto');
  });

  it('FR-27: Detects ghost columns', () => {
    const wb = createMockWorkbook([
      {
        type: 'Request Details',
        data: [
          { 'requestid': 'R1', '__EMPTY_1': 'ghost data' }
        ]
      }
    ]);

    const { issues } = dataQualityRules.run(wb);
    const ghostCol = issues.find(i => i.issueType === 'Ghost Column');
    expect(ghostCol).toBeDefined();
    expect(ghostCol?.severity).toBe('medium');
  });

  it('FR-29: Detects Porter ID mapped to different names across sheets', () => {
    const wb = createMockWorkbook([
      {
        type: 'Porter Performance',
        data: [{ 'porter id': 'P1', 'porter name': 'John Doe' }]
      },
      {
        type: 'Request Details',
        data: [{ 'porter id': 'P1', 'porter name': 'Johnny Doe' }]
      }
    ]);

    const { issues } = dataQualityRules.run(wb);
    const mismatch = issues.find(i => i.issueType === 'Data Inconsistency');
    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe('medium');
  });

  it('FR-31: Detects statistical outliers in TAT values per pool', () => {
    const wb = createMockWorkbook([
      {
        type: 'Request Details',
        data: [
          // Pool A: Mean around 10 mins (600s). StdDev ~ 0.
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          { 'pool name': 'Pool A', 'tat (create to complete)': '00:10:00' },
          // Outlier for Pool A (5 hours)
          { 'pool name': 'Pool A', 'tat (create to complete)': '05:00:00' },
          
          // Pool B: Normally takes 5 hours. So 5 hours is NOT an outlier here.
          { 'pool name': 'Pool B', 'tat (create to complete)': '05:00:00' },
          { 'pool name': 'Pool B', 'tat (create to complete)': '05:00:00' },
          { 'pool name': 'Pool B', 'tat (create to complete)': '05:00:00' },
        ]
      }
    ]);

    const { issues } = dataQualityRules.run(wb);
    const outliers = issues.filter(i => i.issueType === 'Statistical Outlier');
    
    // Should flag the Pool A 5-hour one, but not Pool B
    expect(outliers).toHaveLength(1);
    expect(outliers[0].severity).toBe('low');
    expect(outliers[0].description).toContain('Pool A');
  });

});
