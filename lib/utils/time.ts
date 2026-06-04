import { isValid, parse, differenceInSeconds } from 'date-fns';

/**
 * Converts a time string (e.g. "HH:MM:SS" or decimal/text) into seconds.
 * Returns 0 if invalid or empty.
 */
export function parseDuration(value: unknown): number {
  if (value === null || value === undefined) return 0
  
  // Already a number
  if (typeof value === 'number') return Math.abs(value)
  
  const str = String(value).trim()
  if (!str || str === '0') return 0
  
  // Pure numeric string (seconds)
  if (/^\d+(\.\d+)?$/.test(str)) return Math.abs(parseFloat(str))
  
  // HH:MM:SS or H:MM:SS or MM:SS
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

/**
 * Adds two HH:MM:SS duration strings and returns the result as HH:MM:SS.
 */
export function addDurations(a: string, b: string): string {
  const totalSeconds = parseDuration(a) + parseDuration(b);
  return formatDuration(totalSeconds);
}

/**
 * Calculates the difference in seconds between two HH:MM:SS strings.
 * Returns a - b.
 */
export function durationDiffSeconds(a: string, b: string): number {
  return parseDuration(a) - parseDuration(b);
}

/**
 * Validates if the given value is a correctly formatted HH:MM:SS string.
 */
export function isValidTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const str = value.trim();
  if (str === '') return false;
  const regex = /^(\d+):([0-5]?\d):([0-5]?\d)$/;
  return regex.test(str);
}

/**
 * Helper to format seconds back to HH:MM:SS
 */
export function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].join(':')
}
