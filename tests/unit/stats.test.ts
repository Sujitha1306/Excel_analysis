import { describe, it, expect } from 'vitest';
import { detectOutliers } from '../../lib/utils/stats';

describe('Stats Utility - detectOutliers', () => {
  it('identifies outliers beyond 3 standard deviations (population stddev)', () => {
    // Array with a clear outlier: 1000 is way above the rest.
    // NOTE: Max Z-score for size N is (N-1)/sqrt(N). To get >3 stddev, we need N >= 11.
    const values = [10, 11, 10, 10, 9, 11, 10, 10, 10, 9, 10, 11, 10, 10, 9, 11, 10, 10, 10, 9, 1000];
    const outliers = detectOutliers(values, 3);
    
    expect(outliers).toHaveLength(1);
    expect(outliers[0]).toBe(1000);
  });

  it('returns empty array when there are no outliers', () => {
    const values = [10, 12, 11, 10, 13, 9, 10, 11, 12];
    const outliers = detectOutliers(values, 3);
    expect(outliers).toHaveLength(0);
  });

  it('handles empty arrays gracefully', () => {
    expect(detectOutliers([])).toEqual([]);
  });

  it('handles small arrays gracefully', () => {
    expect(detectOutliers([10])).toEqual([]);
    expect(detectOutliers([10, 1000])).toEqual([]); // With n=2, stddev is large, so 1000 is not > 3 sd
  });

  it('uses 3 as default threshold', () => {
    const values = [10, 11, 10, 10, 9, 11, 10, 10, 10, 9, 10, 11, 10, 10, 9, 11, 10, 10, 10, 9, 1000];
    const outliers = detectOutliers(values);
    expect(outliers).toEqual([1000]);
  });
});
