import { isValid, parse, differenceInSeconds } from 'date-fns';

/**
 * Converts a time string (e.g. "HH:MM:SS" or decimal/text) into seconds.
 * Returns 0 if invalid or empty.
 */
export function parseDuration(value: string | undefined | null): number {
  if (!value) return 0;
  
  const str = String(value).trim();
  if (str === '') return 0;

  // Handle HH:MM:SS or H:M:S format
  const parts = str.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Fallback: try parsing as a number of seconds
  const numeric = parseFloat(str);
  if (!isNaN(numeric)) {
    return numeric;
  }

  return 0;
}

/**
 * Adds two HH:MM:SS duration strings and returns the result as HH:MM:SS.
 */
export function addDurations(a: string, b: string): string {
  const totalSeconds = parseDuration(a) + parseDuration(b);
  return formatSecondsToHHMMSS(totalSeconds);
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
function formatSecondsToHHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
