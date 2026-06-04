import { ParsedWorkbook, ValidationIssue, CrossSheetCheckResult } from '../types';
import { WorkbookMapping } from '../../ai/columnMapper';

export interface RuleModule {
  /**
   * The name or identifier of the rule module (e.g. 'cross-sheet-rules')
   */
  name: string;

  /**
   * Executes the rules against the workbook and returns found issues.
   */
  run: (workbook: ParsedWorkbook, mapping: WorkbookMapping) => {
    issues: ValidationIssue[];
    crossSheetChecks?: CrossSheetCheckResult[];
  };
}
