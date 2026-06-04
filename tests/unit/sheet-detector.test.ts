import { describe, it, expect } from 'vitest';
import { detectSheetType } from '../../lib/validator/sheet-detector';

describe('Sheet Detector', () => {
  it('detects Request Details sheet', () => {
    const headers = ['RequestID', 'Porter Name', 'Status', 'Start Time', 'End Time', 'TAT (Accept to Arrive)', 'TAT (Arrive to Complete)', 'TAT (Assigned to Complete)', 'Completed By', 'Extra Col'];
    expect(detectSheetType(headers)).toBe('Request Details');
  });

  it('detects Location Summary sheet', () => {
    const headers = ['Location', 'Requested', 'Completed', 'Rejected', 'Cancelled', 'Type'];
    expect(detectSheetType(headers)).toBe('Location Summary');
  });

  it('detects Date Summary sheet', () => {
    const headers = ['Date', 'Total Requests', 'Completed', 'Cancelled', 'TAT (Create to Complete)', 'Avg TAT'];
    expect(detectSheetType(headers)).toBe('Date Summary');
  });

  it('detects Pool Summary sheet', () => {
    const headers = ['Pool Name', 'Total Requests', 'Completed', 'Cancelled', 'Open', 'Rejected'];
    expect(detectSheetType(headers)).toBe('Pool Summary');
  });

  it('detects Porter Performance sheet', () => {
    const headers = ['Porter ID', 'Porter Name', 'Completed', 'Total Intime', 'Total Time (Accept to Complete)'];
    expect(detectSheetType(headers)).toBe('Porter Performance');
  });

  it('detects Idle Summary sheet', () => {
    const headers = ['Porter ID', 'Porter Name', 'Total Idle Time', '08:00 - 09:00', '09:00 - 10:00'];
    expect(detectSheetType(headers)).toBe('Idle Summary');
  });

  it('returns Unknown for unrelated sheets', () => {
    const headers = ['Name', 'Age', 'Address', 'Phone'];
    expect(detectSheetType(headers)).toBe('Unknown');
  });

  it('handles empty and malformed headers gracefully', () => {
    expect(detectSheetType([])).toBe('Unknown');
    expect(detectSheetType([null, undefined, ''])).toBe('Unknown');
  });
});
