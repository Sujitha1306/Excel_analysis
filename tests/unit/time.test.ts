import { describe, it, expect } from 'vitest';
import { parseDuration, addDurations, durationDiffSeconds, isValidTime } from '../../lib/utils/time';

describe('Time Utilities', () => {
  describe('parseDuration', () => {
    it('parses valid HH:MM:SS format', () => {
      expect(parseDuration('01:05:30')).toBe(3930);
      expect(parseDuration('00:00:15')).toBe(15);
      expect(parseDuration('12:00:00')).toBe(43200);
    });

    it('handles decimal formats gracefully', () => {
      expect(parseDuration('15.5')).toBe(15.5);
    });

    it('returns 0 for blanks and invalid formats', () => {
      expect(parseDuration('')).toBe(0);
      expect(parseDuration(null)).toBe(0);
      expect(parseDuration(undefined)).toBe(0);
      expect(parseDuration('invalid')).toBe(0);
    });
  });

  describe('addDurations', () => {
    it('adds two durations correctly', () => {
      expect(addDurations('00:10:00', '00:05:30')).toBe('00:15:30');
      expect(addDurations('01:50:00', '00:20:00')).toBe('02:10:00');
    });

    it('handles one invalid/empty duration', () => {
      expect(addDurations('00:05:00', '')).toBe('00:05:00');
    });
  });

  describe('durationDiffSeconds', () => {
    it('returns the difference in seconds', () => {
      expect(durationDiffSeconds('00:15:00', '00:10:00')).toBe(300);
      expect(durationDiffSeconds('00:10:00', '00:15:00')).toBe(-300);
    });
  });

  describe('isValidTime', () => {
    it('returns true for valid formats', () => {
      expect(isValidTime('00:15:30')).toBe(true);
      expect(isValidTime('12:00:00')).toBe(true);
      expect(isValidTime('1:05:05')).toBe(true); // Single digit hour
    });

    it('returns false for invalid formats', () => {
      expect(isValidTime('')).toBe(false);
      expect(isValidTime('15.5')).toBe(false);
      expect(isValidTime('00:65:00')).toBe(false); // Invalid minutes
      expect(isValidTime(null)).toBe(false);
      expect(isValidTime('text')).toBe(false);
    });
  });
});
