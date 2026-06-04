export type Severity = 'critical' | 'medium' | 'low';
export type IssueSource = 'rule' | 'ai';
export type RemediationType = 'auto' | 'manual' | 'review';

export interface AffectedRow {
  rowNumber: number | 'Summary level';
  columnName: string;
  actualValue: unknown;
  expectedValue?: string;
  requestId?: string;
}

export interface ValidationIssue {
  id: string;
  issueType: string;
  category: string;
  sheetName: string;
  severity: Severity;
  condition: string;
  description: string;
  affectedRows: AffectedRow[];
  affectedColumns: string[];
  totalAffectedRows: number;
  remediationSuggestion: string;
  remediationType: RemediationType;
  source: IssueSource;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ParsedSheet {
  sheetName: string;
  type: string;
  rowCount: number;
  colCount: number;
  headerRowIndex?: number;
  headers?: string[];
  data: any[]; // The raw JSON rows
}

export interface ParsedWorkbook {
  fileName: string;
  fileSize: number;
  sheets: ParsedSheet[];
}

export interface CrossSheetCheckResult {
  checkName: string;
  passed: boolean;
  sheetA: string;
  sheetB: string;
  valueA?: string;
  valueB?: string;
  details?: string;
}

export interface ValidationReport {
  fileName: string;
  validatedAt: Date;
  totalIssues: number;
  criticalCount: number;
  mediumCount: number;
  lowCount: number;
  qualityScore: number;
  issues: ValidationIssue[];
  sheetsAnalyzed: string[];
  crossSheetChecks: CrossSheetCheckResult[];
  aiAvailable?: boolean;
}
