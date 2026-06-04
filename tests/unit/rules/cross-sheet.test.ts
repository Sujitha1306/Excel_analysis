import { describe, it, expect } from 'vitest';
import { crossSheetRules } from '../../../lib/validator/rules/cross-sheet';
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

describe('Cross-Sheet Rules (FR-06 to FR-12)', () => {
  it('detects mismatched Date Summary total requests vs Location rows (FR-06)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Date Summary',
        data: [{ date: '2024-05-01', 'total requests': 100 }]
      },
      {
        type: 'Location Summary',
        data: [
          { location: 'ER', requested: 50 },
          { location: 'ICU', requested: 40 } // Total is 90, not 100
        ]
      }
    ]);

    const result = crossSheetRules.run(wb);
    
    const issue = result.crossSheetChecks?.find(c => c.checkName === 'FR-06: Date Summary Total vs Location Summary Sum');
    expect(issue?.passed).toBe(false);
    expect(issue?.valueA).toBe('100');
    expect(issue?.valueB).toBe('90');
    
    const violation = result.issues.find(i => i.issueType === 'cross_sheet_mismatch');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('critical');
  });

  it('detects mismatched completed counts (FR-07) and cancelled counts (FR-08)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Date Summary',
        data: [{ date: '2024-05-01', completed: 80, cancelled: 10 }]
      },
      {
        type: 'Pool Summary',
        data: [{ 'pool name': 'Pool A', completed: 75 }] // FR-07 fail (75 != 80)
      },
      {
        type: 'Location Summary',
        data: [{ location: 'ER', cancelled: 10 }] // FR-08 pass (10 == 10)
      }
    ]);

    const result = crossSheetRules.run(wb);
    
    const fr07 = result.crossSheetChecks?.find(c => c.checkName.includes('FR-07'));
    expect(fr07?.passed).toBe(false);
    
    const fr08 = result.crossSheetChecks?.find(c => c.checkName.includes('FR-08'));
    expect(fr08?.passed).toBe(true);
  });

  it('validates porter count between Pool Summary and Performance (FR-09)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Pool Summary',
        data: [{ 'pool name': 'Total', 'porter count': 3 }]
      },
      {
        type: 'Porter Performance',
        data: [
          { 'porter id': 'P1' },
          { 'porter id': 'P2' } // Only 2 unique porters
        ]
      }
    ]);

    const result = crossSheetRules.run(wb);
    const fr09 = result.crossSheetChecks?.find(c => c.checkName.includes('FR-09'));
    expect(fr09?.passed).toBe(false);
  });

  it('validates Date Summary TAT average vs Request Details TATs (FR-10)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Date Summary',
        data: [{ date: '2024-05-01', 'tat (create to complete)': '00:10:00' }] // 600s
      },
      {
        type: 'Request Details',
        data: [
          { 'tat (create to complete)': '00:15:00' }, // 900s
          { 'tat (create to complete)': '00:05:00' }  // 300s -> avg is 600s
        ]
      }
    ]);

    const result = crossSheetRules.run(wb);
    const fr10 = result.crossSheetChecks?.find(c => c.checkName.includes('FR-10'));
    expect(fr10?.passed).toBe(true);

    // Now make it fail
    wb.sheets[1].data[1]['tat (create to complete)'] = '00:20:00'; // avg is now 1050s
    const failResult = crossSheetRules.run(wb);
    const fr10Fail = failResult.crossSheetChecks?.find(c => c.checkName.includes('FR-10'));
    expect(fr10Fail?.passed).toBe(false);
  });

  it('ensures every porter in Performance is in Idle Summary (FR-11)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Porter Performance',
        data: [{ 'porter id': 'P1' }, { 'porter id': 'P2' }]
      },
      {
        type: 'Idle Summary',
        data: [{ 'porter id': 'P1' }] // P2 is missing
      }
    ]);

    const result = crossSheetRules.run(wb);
    const fr11 = result.crossSheetChecks?.find(c => c.checkName.includes('FR-11'));
    expect(fr11?.passed).toBe(false);
    expect(fr11?.details).toContain('p2');
    
    // Check severity from issue formatter
    const issue = result.issues.find(i => i.issueType === 'missing_idle_entry');
    expect(issue?.severity).toBe('low'); // from Priority Matrix
  });

  it('ensures Total time worked >= sum of completed TATs (FR-12)', () => {
    const wb = createMockWorkbook([
      {
        type: 'Porter Performance',
        data: [{ 'porter id': 'P1', 'total intime': '00:20:00' }] // 1200s
      },
      {
        type: 'Request Details',
        data: [
          { 'porter id': 'P1', status: 'Completed', 'tat (accept to complete)': '00:15:00' }, // 900s
          { 'porter id': 'P1', status: 'Completed', 'tat (accept to complete)': '00:10:00' }  // 600s -> sum 1500s > 1200s
        ]
      }
    ]);

    const result = crossSheetRules.run(wb);
    const issue = result.issues.find(i => i.issueType === 'time_worked_deficit');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('critical'); // Mismatch in time tracking
  });
});
