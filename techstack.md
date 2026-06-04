# Tech Stack Document
## Excel Validation & Audit Tool — Hospital Porter Management Data
**Version:** 1.0  
**Date:** June 2026  
**Status:** Approved for Development

---

## 1. Architecture Overview

The application follows a **Single-Page Application (SPA)** architecture with a lightweight serverless backend for file processing and AI integration. All sensitive file data is processed ephemerally — never persisted to a database.

```
┌──────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│  React SPA  →  Excel Parser  →  Rule Engine          │
│                 (client-side)    (client-side)       │
└───────────────────────┬──────────────────────────────┘
                        │ AI validation request
                        ▼
┌──────────────────────────────────────────────────────┐
│              Backend / Serverless API                │
│   Next.js API Routes  →  Claude API  →  Report Gen   │
└──────────────────────────────────────────────────────┘
```

**Key Architecture Decision:** Excel parsing and rule-based validation runs entirely **client-side in the browser** using SheetJS. This avoids uploading potentially sensitive patient/staff data to a server. Only a structured JSON summary of anomalies (no raw data) is sent to the AI API.

---

## 2. Frontend

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.x | UI component framework |
| **Next.js** | 14.x | Full-stack framework, API routes, routing |
| **TypeScript** | 5.x | Type safety across all components and validation logic |

### UI & Styling
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Tailwind CSS** | 3.x | Utility-first styling, rapid UI development |
| **shadcn/ui** | Latest | Pre-built accessible component library (Dialog, Tabs, Badge, Card, etc.) |
| **Lucide React** | 0.383.0 | Icon library for UI actions |
| **Framer Motion** | 10.x | Animations for issue reveal, panel transitions |

### Data Visualization
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Recharts** | Latest | Bar charts for issue distribution, severity breakdown |
| **react-table (TanStack Table)** | 8.x | Virtualized data tables for large request detail sheets |

### Excel Processing (Client-Side)
| Technology | Version | Purpose |
|-----------|---------|---------|
| **SheetJS (xlsx)** | Latest | Parse `.xlsx`/`.xls` files, extract sheet data as JSON |
| **date-fns** | 3.x | Parse, compare, and validate time fields (HH:MM:SS, datetime) |
| **lodash** | 4.x | Deep comparison, groupBy, statistical helpers for validation rules |

### File Upload
| Technology | Version | Purpose |
|-----------|---------|---------|
| **react-dropzone** | 14.x | Drag-and-drop file upload with validation |

---

## 3. Backend

### Runtime & Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js API Routes** | 14.x | Serverless API endpoints (no standalone server needed) |
| **Node.js** | 20.x LTS | Runtime environment |

### AI Integration
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Anthropic SDK** | Latest | Claude API integration for AI-powered anomaly detection |
| **Claude claude-sonnet-4-20250514** | — | AI model for natural language issue analysis and remediation suggestions |

**AI Prompt Strategy:**
- Rule-based validation runs client-side and produces a structured JSON anomaly report
- The JSON report (not raw Excel data) is sent to Claude with a system prompt describing the hospital data schema
- Claude returns: additional anomalies detected, descriptions, remediation, and confidence scores
- Total tokens per validation request: ~2,000–4,000 (well within limits)

### Report Generation
| Technology | Version | Purpose |
|-----------|---------|---------|
| **jsPDF** | 2.x | Client-side PDF generation |
| **jsPDF-AutoTable** | 3.x | Table rendering in PDF reports |
| **docx** (npm) | 8.x | Word document generation for downloadable reports |

---

## 4. Validation Engine Architecture

The validation engine is a pure TypeScript module that runs in the browser. It follows a **pipeline pattern**:

```
Raw Excel (SheetJS JSON)
        │
        ▼
┌─────────────────┐
│  Sheet Detector  │  → Infers sheet type from column headers
└────────┬────────┘
         ▼
┌─────────────────┐
│  Schema Parser   │  → Normalizes column names, parses time fields
└────────┬────────┘
         ▼
┌─────────────────┐
│  Rule Runner     │  → Runs all FR-06 through FR-32 checks
│  (per-sheet &    │
│  cross-sheet)    │
└────────┬────────┘
         ▼
┌─────────────────┐
│  AI Enrichment   │  → Sends JSON summary to Claude API
│  (async)         │  → Merges AI findings with rule findings
└────────┬────────┘
         ▼
┌─────────────────┐
│  Issue Formatter │  → Produces final IssueReport[] for UI
└─────────────────┘
```

### Core Data Types (TypeScript)

```typescript
type Severity = 'critical' | 'medium' | 'low';
type IssueSource = 'rule' | 'ai';
type RemediationType = 'auto' | 'manual' | 'review';

interface ValidationIssue {
  id: string;
  sheet: string;
  severity: Severity;
  issueType: string;
  description: string;           // AI-generated natural language
  affectedCells: CellRef[];      // [{sheet, row, col, value}]
  expectedValue?: string;
  actualValue?: string;
  remediationSuggestion: string;
  remediationType: RemediationType;
  source: IssueSource;
  confidence?: 'high' | 'medium' | 'low'; // for AI-sourced issues
  crossSheetRefs?: CellRef[];    // for cross-sheet issues
}

interface CellRef {
  sheet: string;
  row: number;
  col: number;
  value: unknown;
  displayAddress: string;        // e.g., "Sheet1!C14"
}

interface ValidationReport {
  fileName: string;
  validatedAt: Date;
  totalIssues: number;
  criticalCount: number;
  mediumCount: number;
  lowCount: number;
  qualityScore: number;          // 0–100
  issues: ValidationIssue[];
  sheetsAnalyzed: string[];
  crossSheetChecks: CrossSheetCheckResult[];
}
```

---

## 5. Key Rule Implementations

### Cross-Sheet Count Check (FR-06)
```typescript
// Date Summary total requests vs sum of Location Summary rows
const dateSummaryTotal = getCell(sheets['Date Summary'], 'Total Requests');
const locationSum = sheets['Location Summary']
  .filter(row => row.Type === 'Source')
  .reduce((sum, row) => sum + row.Requested, 0);

if (dateSummaryTotal !== locationSum) {
  issues.push({
    severity: 'critical',
    issueType: 'CROSS_SHEET_COUNT_MISMATCH',
    affectedCells: [
      { sheet: 'Date Summary', ...cellRef('Requests') },
      { sheet: 'Location Summary', ...cellRef('Requested', 'TOTAL') }
    ],
    expectedValue: String(locationSum),
    actualValue: String(dateSummaryTotal)
  });
}
```

### TAT Arithmetic Check (FR-18)
```typescript
// For each completed request row:
// TAT(Assigned→Complete) ≈ TAT(Accept→Arrive) + TAT(Arrive→Complete)
requestRows.forEach((row, i) => {
  if (row.Status !== 'Completed') return;
  const computed = addDurations(row['TAT (Accept to Arrive)'], row['TAT (Arrive to Complete)']);
  const recorded = row['TAT (Assigned to Complete)'];
  if (Math.abs(durationDiffSeconds(computed, recorded)) > 5) { // 5s tolerance
    issues.push({ severity: 'critical', row: i, ... });
  }
});
```

### Whitespace Detection (FR-26)
```typescript
nameFields.forEach(field => {
  rows.forEach((row, i) => {
    if (typeof row[field] === 'string' && row[field] !== row[field].trim()) {
      issues.push({ severity: 'medium', issueType: 'WHITESPACE_IN_NAME', ... });
    }
  });
});
```

---

## 6. State Management

| State Layer | Tool | Scope |
|------------|------|-------|
| UI State (filters, panels, tabs) | React `useState` / `useReducer` | Component-local |
| Validation Results | React Context + `useReducer` | App-wide |
| File upload progress | React `useState` | Upload component |
| Acknowledged issues | React Context (session only) | App-wide |

No external state library (Redux/Zustand) needed for v1.0 given the single-session, no-persistence nature.

---

## 7. Development & Build Tooling

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager (faster than npm, better monorepo support) |
| **ESLint** | Code linting with TypeScript rules |
| **Prettier** | Code formatting |
| **Vitest** | Unit testing for validation rule engine |
| **Playwright** | E2E testing for upload-to-report flow |
| **Husky + lint-staged** | Pre-commit hooks |

---

## 8. Deployment

| Layer | Platform | Reason |
|-------|---------|--------|
| Frontend + API | **Vercel** | Native Next.js support, zero-config deployment, serverless API routes |
| Environment secrets | Vercel Environment Variables | Anthropic API key stored server-side only |
| CDN | Vercel Edge Network | Static asset delivery |

**No database required for v1.0.** All state is session-local.

---

## 9. Security Considerations

- Anthropic API key stored only as a server-side environment variable; never exposed to the client
- Excel files are parsed client-side (SheetJS in browser); raw file bytes never transmitted to server
- Only structured JSON anomaly summaries (no PII/patient data) are sent to Claude API
- `Content-Security-Policy` headers configured to prevent XSS
- File size limit enforced both client-side (react-dropzone) and server-side (Next.js API route middleware)
- All API routes validate input schema before processing

---

## 10. Performance Targets & Strategies

| Scenario | Target | Strategy |
|---------|--------|----------|
| Excel parse (1000 rows, 6 sheets) | < 2s | SheetJS lazy parsing; only read used columns |
| Rule validation (all checks) | < 5s | Batch processing; avoid nested loops with index maps |
| AI enrichment | < 15s | Single API call with full anomaly JSON; streaming response |
| Report PDF generation | < 5s | jsPDF with autoTable; generate client-side |
| Initial page load | < 2s | Next.js code splitting; lazy-load validation engine |

---

## 11. Testing Strategy

### Unit Tests (Vitest)
- Every validation rule function has unit tests with:
  - Happy path (no issue)
  - Known bad data (issue detected)
  - Edge cases (empty sheet, merged cells, missing column)

### Integration Tests
- Full pipeline test using the provided sample Excel (BLK Max Hospital dataset)
- Verify all known issues in the sample are detected

### E2E Tests (Playwright)
- Upload file → validation runs → issues listed → click issue → panel opens → download report

### Test Data
- Curated test Excel files with deliberate planted errors per issue type
- The BLK Max Hospital sample file as the primary integration test fixture

---

## 12. Folder Structure

```
excel-validator/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing / upload page
│   ├── validate/
│   │   └── page.tsx              # Results dashboard
│   └── api/
│       ├── ai-validate/route.ts  # Claude AI enrichment endpoint
│       └── generate-report/route.ts # Report generation endpoint
├── components/
│   ├── upload/                   # FileDropzone, SheetPreview
│   ├── dashboard/                # IssueFeed, IssueCard, IssueDetailPanel
│   ├── charts/                   # SeverityChart, SheetBreakdown
│   └── report/                   # ReportPreview
├── lib/
│   ├── validator/
│   │   ├── index.ts              # Main pipeline orchestrator
│   │   ├── sheet-detector.ts     # Infer sheet type from headers
│   │   ├── rules/
│   │   │   ├── cross-sheet.ts    # FR-06 to FR-12
│   │   │   ├── request-details.ts # FR-13 to FR-18
│   │   │   ├── porter-performance.ts # FR-19, FR-20
│   │   │   ├── location-summary.ts # FR-21
│   │   │   ├── pool-summary.ts   # FR-22
│   │   │   └── data-quality.ts   # FR-24 to FR-32
│   │   └── types.ts              # ValidationIssue, CellRef, etc.
│   ├── ai/
│   │   └── enrichment.ts         # Claude API integration
│   ├── report/
│   │   ├── pdf.ts                # jsPDF report generation
│   │   └── docx.ts               # Word report generation
│   └── utils/
│       ├── time.ts               # HH:MM:SS parsing, arithmetic
│       └── stats.ts              # Outlier detection, averages
├── tests/
│   ├── unit/                     # Rule unit tests
│   ├── integration/              # Full pipeline tests
│   └── fixtures/                 # Test Excel files
└── public/
    └── sample/                   # Sample file for demo
```

---

## 13. Dependencies Summary

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "xlsx": "^0.18.5",
    "date-fns": "^3.0.0",
    "lodash": "^4.17.21",
    "react-dropzone": "^14.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "recharts": "^2.8.0",
    "@tanstack/react-table": "^8.0.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.6.0",
    "docx": "^8.0.0",
    "framer-motion": "^10.0.0",
    "lucide-react": "^0.383.0",
    "tailwindcss": "^3.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "@testing-library/react": "^14.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.0.0"
  }
}
```
