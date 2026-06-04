import { ParsedWorkbook, ValidationIssue, CrossSheetCheckResult } from '../types';

export interface RuleModule {
  /**
   * The name or identifier of the rule module (e.g. 'cross-sheet-rules')
   */
  name: string;

  /**
   * Executes the rules against the workbook and returns found issues.
   */
  run: (workbook: ParsedWorkbook) => {
    issues: ValidationIssue[];
    crossSheetChecks?: CrossSheetCheckResult[];
  };
}
