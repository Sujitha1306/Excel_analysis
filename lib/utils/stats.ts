/**
 * Detects outliers in an array of numbers using Population Standard Deviation.
 * Formula: value > mean + (threshold * stdDev)
 * @param values Array of numerical values (e.g., TATs for a specific pool)
 * @param threshold Number of standard deviations (defaults to 3)
 * @returns Array of outlier values
 */
export function detectOutliers(values: number[], threshold: number = 3): number[] {
  if (!values || values.length <= 2) {
    return [];
  }

  // Calculate Mean
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;

  // Calculate Population Standard Deviation
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return []; // All values are identical

  const upperLimit = mean + (threshold * stdDev);

  // Return values that exceed the limit
  return values.filter(val => val > upperLimit);
}
