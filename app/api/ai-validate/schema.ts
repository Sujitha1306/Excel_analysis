import { z } from 'zod';

// We just validate the high-level shape to ensure it's a ValidationReport
export const ValidationReportSchema = z.object({
  fileName: z.string(),
  validatedAt: z.coerce.date().or(z.string()),
  totalIssues: z.number().int(),
  criticalCount: z.number().int(),
  mediumCount: z.number().int(),
  lowCount: z.number().int(),
  qualityScore: z.number(),
  sheetsAnalyzed: z.array(z.string()),
  issues: z.array(z.any()), // Can be more strictly typed but any is fine for simple DoS protection
  crossSheetChecks: z.array(z.any()).optional()
});

export const GenerateReportRequestSchema = z.object({
  report: ValidationReportSchema,
  format: z.enum(['pdf', 'docx']),
  sections: z.object({
    executiveSummary: z.boolean(),
    perSheetDetails: z.boolean(),
    crossSheetComparison: z.boolean(),
    remediation: z.boolean(),
  })
});
