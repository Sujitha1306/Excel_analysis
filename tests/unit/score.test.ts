import { describe, it, expect } from 'vitest';
import { calculateQualityScore } from '../../lib/validator/score';
import { ValidationReport, ValidationIssue } from '../../lib/validator/types';

function createMockReport(critical: number, medium: number, low: number): ValidationReport {
  const issues: ValidationIssue[] = [];
  
  for (let i = 0; i < critical; i++) issues.push({ severity: 'critical' } as ValidationIssue);
  for (let i = 0; i < medium; i++) issues.push({ severity: 'medium' } as ValidationIssue);
  for (let i = 0; i < low; i++) issues.push({ severity: 'low' } as ValidationIssue);

  return {
    issues
  } as unknown as ValidationReport;
}

describe('Quality Score Calculator', () => {
  it('Starts at 100 with no issues', () => {
    expect(calculateQualityScore(createMockReport(0, 0, 0))).toBe(100);
  });

  it('Deducts 10 per Critical, capped at -50', () => {
    expect(calculateQualityScore(createMockReport(3, 0, 0))).toBe(70); // 100 - 30
    expect(calculateQualityScore(createMockReport(5, 0, 0))).toBe(50); // 100 - 50
    expect(calculateQualityScore(createMockReport(10, 0, 0))).toBe(50); // Cap reached
  });

  it('Deducts 3 per Medium, capped at -30', () => {
    expect(calculateQualityScore(createMockReport(0, 5, 0))).toBe(85); // 100 - 15
    expect(calculateQualityScore(createMockReport(0, 10, 0))).toBe(70); // 100 - 30
    expect(calculateQualityScore(createMockReport(0, 20, 0))).toBe(70); // Cap reached
  });

  it('Deducts 1 per Low, capped at -20', () => {
    expect(calculateQualityScore(createMockReport(0, 0, 5))).toBe(95); // 100 - 5
    expect(calculateQualityScore(createMockReport(0, 0, 20))).toBe(80); // 100 - 20
    expect(calculateQualityScore(createMockReport(0, 0, 50))).toBe(80); // Cap reached
  });

  it('Combines deductions and floors at 0', () => {
    // Critical: -50 (max), Medium: -30 (max), Low: -20 (max) => 100 - 100 = 0
    expect(calculateQualityScore(createMockReport(10, 20, 50))).toBe(0);
    
    // Critical: -40, Medium: -15, Low: -5 => 100 - 60 = 40
    expect(calculateQualityScore(createMockReport(4, 5, 5))).toBe(40);
  });
});
