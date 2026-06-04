# Product Requirements Document (PRD)
## Excel Validation & Audit Tool — Hospital Porter Management Data
**Version:** 1.0  
**Date:** June 2026  
**Author:** Product Team  
**Status:** Draft for Review

---

## 1. Executive Summary

The Excel Validation & Audit Tool is an AI-powered web application designed to ingest raw hospital operational Excel files (specifically porter/transport management data), automatically detect data anomalies, cross-page inconsistencies, miscalculations, formatting issues, and data quality problems — then present findings in a structured, interactive dashboard with downloadable reports.

The primary motivation is that raw operational data arrives with human errors, auto-cancellation artifacts, missing values, and cross-sheet calculation drifts that go undetected and pollute downstream analytics. This tool acts as a pre-processing quality gate before any further reporting or execution.

---

## 2. Problem Statement

Hospital porter management systems export raw Excel workbooks containing multiple sheets:
- **Location-wise Summary** (aggregated request metrics by floor)
- **Date-wise Summary** (daily totals with TAT breakdowns)
- **Pool-wise TAT** (per-pool performance)
- **Request Details** (granular row-level event log)
- **Porter Performance Summary** (individual porter KPIs)
- **Porter Idle Summary** (hourly idle time grid)

These sheets are generated from live systems and contain systematic errors including:

- Totals on summary pages not matching the sum of detail rows
- TAT (Turnaround Time) values inconsistent across sheets for the same time period
- Blank porter names or requester names in required fields
- Leading/trailing whitespace in name fields causing split-grouping in analytics
- Completed tasks with no "Completed By" field populated
- Request Time Status categorized outside the two defined categories (`Less than 3mins`, `More than 30mins`)
- Ghost/empty columns with no header that carry phantom data
- Cancelled requests with non-zero TAT values that should be null
- Cross-page count mismatches (e.g., total requests on Date Summary ≠ sum of all Location rows)
- TAT fields that are zero or blank but status shows "Completed"
- Porter IDs present in performance sheet but absent in idle sheet (or vice versa)
- Time format inconsistencies (HH:MM:SS vs decimal hours vs blank)
- Duplicate request IDs in the request details sheet
- Sample collection requests counted under wrong pool in summary

---

## 3. Goals & Objectives

### Primary Goals
1. Automatically detect all data quality issues in a multi-sheet hospital Excel workbook
2. Present issues categorized by severity (Critical / Medium / Low) and by sheet
3. Allow users to click any issue and view the exact cell(s)/rows involved with highlighted context
4. Provide AI-generated natural language explanations and suggested remediation steps
5. Generate a downloadable PDF/Word report summarizing all findings

### Secondary Goals
- Support for any hospital operational Excel (not just porter data) through AI-driven schema inference
- Provide confidence scores on AI-detected anomalies
- Track validation history across multiple file uploads

### Out of Scope (v1.0)
- Direct editing/fixing of the Excel file within the app
- Real-time system integration (API-based data ingestion)
- Multi-user collaboration or role-based access

---

## 4. Target Users

| User | Role | Primary Need |
|------|------|-------------|
| Hospital Operations Analyst | Uploads and validates data before reporting | Fast identification of errors with guided fixes |
| Department Manager | Reviews validation reports | Summary-level view of data quality before decisions |
| IT/Data Team | Maintains data pipeline | Technical error logs for debugging source systems |

---

## 5. Functional Requirements

### 5.1 File Upload & Parsing

- **FR-01:** Accept `.xlsx` and `.xls` files up to 50MB
- **FR-02:** Parse all sheets automatically; detect sheet names and infer their type (summary, detail, performance, idle)
- **FR-03:** Display a sheet-by-sheet preview before validation begins
- **FR-04:** Handle merged cells, hidden columns, and multi-row headers gracefully
- **FR-05:** Support files with 1 to 20 sheets

### 5.2 Validation Engine — Rule-Based Checks

#### Cross-Sheet Consistency Checks
- **FR-06:** Total requests on Date Summary sheet must equal the sum of all Location Summary rows for the same date
- **FR-07:** Total completed on Date Summary must equal sum of pool-wise completed values
- **FR-08:** Total cancelled on Date Summary must equal sum of location-wise cancelled values
- **FR-09:** Porter count on Pool Summary must match the number of unique porter IDs in Porter Performance sheet
- **FR-10:** TAT (Create to Complete) on Date Summary must be consistent with the average of all request-level TAT values in Request Details
- **FR-11:** Porters in Performance sheet must have a corresponding entry in Idle Summary sheet
- **FR-12:** Total time worked per porter in Performance sheet must be >= sum of TAT values for their completed requests

#### Within-Sheet Integrity Checks
- **FR-13:** Request Details — "Completed By" must not be blank when Status = "Completed"
- **FR-14:** Request Details — TAT fields must be blank/zero when Status = "Cancelled" (except Duration Create to Complete)
- **FR-15:** Request Details — Duplicate `requestid` values must be flagged
- **FR-16:** Request Details — `Request time status` must be one of: `Less than 3mins`, `More than 30mins`, or blank for non-completed
- **FR-17:** Request Details — Start time must be before End time; if reversed, flag as critical
- **FR-18:** Request Details — TAT (Assigned to Complete) must approximately equal TAT (Accept to Arrive) + TAT (Arrive to Complete)
- **FR-19:** Porter Performance — Completed count must equal the number of matching completed rows in Request Details per porter
- **FR-20:** Porter Performance — Total Intime must be ≥ Total Time (Accept to Complete)
- **FR-21:** Location Summary — Sum of (Completed + Rejected + Cancelled) must equal Requested
- **FR-22:** Pool Summary — Sum of (Completed + Cancelled + Open + Rejected) must equal Total Requests
- **FR-23:** Idle Summary — Hourly idle values must sum to Total Idle Time for each porter

#### Data Quality Checks
- **FR-24:** Detect blank values in required fields: Porter Name, Request ID, Start Time, End Time, Status, Pool Name
- **FR-25:** Detect whitespace-only strings (names that appear blank but contain spaces)
- **FR-26:** Detect leading/trailing whitespace in all name/category fields
- **FR-27:** Detect ghost columns — columns with no header but containing data
- **FR-28:** Detect ghost rows — rows beyond the last data row that contain partial data
- **FR-29:** Detect name inconsistencies — same Porter ID mapped to different names across sheets
- **FR-30:** Detect time format inconsistencies — fields that mix HH:MM:SS with decimal or text formats
- **FR-31:** Detect statistical outliers in TAT values (values > 3 standard deviations from mean per pool)
- **FR-32:** Detect zero-duration completed requests (Start time = End time) as suspicious

### 5.3 AI-Powered Validation

- **FR-33:** After rule-based checks, send sheet summaries + anomaly context to Claude API for additional pattern detection
- **FR-34:** AI to identify anomalies not covered by predefined rules (e.g., unusual naming patterns, unexpected status transitions, suspicious TAT sequences)
- **FR-35:** AI to generate a 2–3 sentence natural language description of each detected issue
- **FR-36:** AI to suggest remediation: "This can be auto-corrected by trimming whitespace" vs. "Requires manual review of source system"
- **FR-37:** AI confidence score (High / Medium / Low) displayed per AI-detected issue

### 5.4 Results Dashboard

- **FR-38:** Issues grouped by sheet, then by severity (Critical → Medium → Low)
- **FR-39:** Each issue card shows: Issue Type, Affected Cell/Row Reference, Expected Value, Actual Value, AI Description, Remediation Suggestion
- **FR-40:** Clicking an issue opens a split-panel view:
  - Left: Issue detail with full context
  - Right: Mini-table showing the affected rows/cells with the problematic values highlighted in red/yellow
  - For cross-sheet issues: both sheets shown side by side with the conflicting values
- **FR-41:** Summary statistics bar: Total Issues, Critical Count, Medium Count, Low Count, Sheets Affected
- **FR-42:** Filter bar: filter by sheet, by severity, by issue type, by status (open/acknowledged)
- **FR-43:** "Mark as Acknowledged" toggle per issue (persists during session)

### 5.5 Report Generation

- **FR-44:** "Download Report" button generates a PDF and/or Word document
- **FR-45:** Report structure:
  - Cover page: File name, validation date, total issue summary
  - Executive Summary: 3–5 sentences AI-generated overview of data quality
  - Per-sheet sections: Issues listed with cell references, expected vs. actual values, remediation
  - Appendix: Full list of cross-sheet comparisons with pass/fail status
- **FR-46:** Report includes a "Data Quality Score" (0–100) calculated from issue counts weighted by severity

---

## 6. Non-Functional Requirements

- **NFR-01 Performance:** Full validation of a 1000-row, 6-sheet Excel file must complete within 30 seconds
- **NFR-02 Accuracy:** Rule-based checks must have 100% accuracy; AI checks must achieve ≥ 85% precision on test datasets
- **NFR-03 Usability:** Non-technical users must be able to interpret all findings without external help
- **NFR-04 Reliability:** Application must handle malformed Excel files without crashing; show clear error messages
- **NFR-05 Security:** Uploaded files processed in memory only; not stored on server beyond the session
- **NFR-06 Compatibility:** Support latest versions of Chrome, Edge, Firefox, and Safari

---

## 7. Validation Rule Priority Matrix

| Rule Category | Severity | Auto-Fixable | Example |
|--------------|----------|-------------|---------|
| Cross-sheet count mismatch | Critical | No | Date Summary total ≠ Location rows sum |
| TAT arithmetic error | Critical | No | Accept→Arrive + Arrive→Complete ≠ Accept→Complete |
| Completed with no porter | Critical | No | Status=Completed, CompletedBy=blank |
| Duplicate Request ID | Critical | No | Same requestid appears twice |
| Time reversal (end < start) | Critical | No | End time earlier than start time |
| Whitespace in name fields | Medium | Yes | "salma " vs "salma" |
| Blank required fields | Medium | No | Porter name blank |
| Wrong Request Time Status | Medium | Partial | Status value outside defined list |
| Ghost columns | Medium | No | Column with data but no header |
| TAT outlier (statistical) | Low | No | TAT = 5 hrs when average is 10 mins |
| Zero-duration completed | Low | No | Start time = End time, status Completed |
| Porter missing from idle sheet | Low | No | Porter in performance not in idle grid |

---

## 8. User Stories

- **US-01:** As an analyst, I want to upload an Excel file and see all issues within 30 seconds so I can quickly assess data quality before reporting.
- **US-02:** As an analyst, I want to click on a specific issue and see exactly which cell/row is wrong, along with the expected value, so I know precisely what to fix.
- **US-03:** As a manager, I want to download a clean PDF report of all issues so I can share it with my team without them needing access to the tool.
- **US-04:** As an analyst, I want AI to catch issues I haven't thought of, not just the predefined rules.
- **US-05:** As an IT admin, I want to know when a cross-sheet total doesn't match so I can trace the error back to the source system.
- **US-06:** As an analyst, I want to mark issues as "acknowledged" so I can track which ones I've reviewed.

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Issue detection rate (known test set) | ≥ 95% |
| False positive rate | ≤ 10% |
| Validation time for standard file | ≤ 30 seconds |
| User task completion rate (find & understand an issue) | ≥ 90% in usability test |
| Report generation time | ≤ 10 seconds |

---

## 10. Assumptions & Constraints

- The Excel file follows the general schema observed in the hospital porter management export (6 sheet types); additional sheet types will be handled by AI inference
- The application is single-user per session (no concurrent multi-user editing of the same file)
- AI API (Claude) is available and responsive; a fallback to rule-based-only mode exists if AI is unavailable
- The tool is a validator, not an editor — it identifies but does not modify the source file

---

## 11. Open Questions

1. Should the tool support historical comparison (upload this week vs. last week)?
2. Should there be a "whitelist" to suppress known acceptable anomalies?
3. Should the data quality score be exportable for tracking over time?
4. Is there a need for role-based access (analyst vs. read-only manager view)?
