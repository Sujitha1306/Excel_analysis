# Design Document
## Excel Validation & Audit Tool — Hospital Porter Management Data
**Version:** 1.0  
**Date:** June 2026  
**Status:** Ready for Implementation

---

## 1. Design Philosophy

The tool serves operational analysts and managers in a high-stakes hospital environment. The design follows three principles:

1. **Clarity over aesthetics** — Every element must communicate data quality status immediately, without decoration for its own sake
2. **Precision without overwhelm** — Hundreds of issues must be scannable, filterable, and digestible, not a wall of text
3. **Trust through transparency** — Users must understand *why* something is flagged, not just *what* is flagged

The visual language borrows from medical diagnostic dashboards: clean white backgrounds, purposeful use of severity color, and a calm neutral palette interrupted only by issue indicators.

---

## 2. Color System

### Severity Colors
| Severity | Background | Border | Text | Icon |
|---------|-----------|--------|------|------|
| Critical | `#FEF2F2` | `#EF4444` | `#991B1B` | Red X |
| Medium | `#FFFBEB` | `#F59E0B` | `#92400E` | Yellow Warning |
| Low | `#EFF6FF` | `#3B82F6` | `#1E40AF` | Blue Info |
| Pass (no issues) | `#F0FDF4` | `#22C55E` | `#166534` | Green Check |

### Brand/Neutral Palette
| Role | Color | Hex |
|------|-------|-----|
| Primary action | Indigo | `#4F46E5` |
| Background | Slate-50 | `#F8FAFC` |
| Card surface | White | `#FFFFFF` |
| Border default | Slate-200 | `#E2E8F0` |
| Text primary | Slate-900 | `#0F172A` |
| Text secondary | Slate-500 | `#64748B` |
| Text muted | Slate-400 | `#94A3B8` |

### Sheet Tab Colors (for visual distinction)
| Sheet Type | Color |
|-----------|-------|
| Location Summary | Violet `#7C3AED` |
| Date Summary | Blue `#2563EB` |
| Pool Summary | Cyan `#0891B2` |
| Request Details | Orange `#EA580C` |
| Porter Performance | Green `#16A34A` |
| Porter Idle | Slate `#475569` |

---

## 3. Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| App title | Inter | 24px | 700 |
| Page headings | Inter | 20px | 600 |
| Section headings | Inter | 16px | 600 |
| Body text | Inter | 14px | 400 |
| Table cells | Inter | 13px | 400 |
| Badge/label | Inter | 11px | 500 |
| Monospace (cell refs) | JetBrains Mono | 12px | 400 |

---

## 4. Application Screens

### 4.1 Screen 1 — Upload Page

**Layout:** Full-screen centered card on a slate-50 background

**Elements:**
```
┌──────────────────────────────────────────┐
│  🏥 ExcelAudit  [Header — indigo logo]   │
├──────────────────────────────────────────┤
│                                          │
│   Validate Your Hospital Excel Data      │
│   [subtitle: Powered by AI + Rule Engine]│
│                                          │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │   ⬆  Drag & drop your .xlsx file  │  │
│  │   or click to browse               │  │
│  │                                    │  │
│  │   Supports: .xlsx, .xls up to 50MB │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [Try with sample file →]               │
│                                          │
│  ──── What gets checked ────────────    │
│  ✓ Cross-sheet count consistency         │
│  ✓ TAT arithmetic validation             │
│  ✓ Missing & whitespace field detection  │
│  ✓ Duplicate ID detection                │
│  ✓ AI-powered anomaly detection          │
└──────────────────────────────────────────┘
```

**Interactions:**
- Drop zone animates to indigo border + light indigo fill on hover/drag
- On file selection: shows filename + size + sheet count (parsed immediately)
- "Validate" button appears below dropzone after file selected (indigo, full-width)

---

### 4.2 Screen 2 — Sheet Preview Modal

Appears after file selected, before validation runs.

```
┌─────────────────────────────────────────────────┐
│ Preview: BLK_Max_Hospital.xlsx          [×]      │
├─────────────────────────────────────────────────┤
│ 6 sheets detected                               │
│                                                 │
│ ● Location Summary      240 rows  8 columns     │
│   Detected type: Location Summary ✓             │
│                                                 │
│ ● Date Summary           1 row   15 columns     │
│   Detected type: Date Summary ✓                 │
│                                                 │
│ ● Pool Summary           3 rows  14 columns     │
│   Detected type: Pool Summary ✓                 │
│                                                 │
│ ● Request Details      240 rows  24 columns     │
│   Detected type: Request Details ✓              │
│                                                 │
│ ● Porter Performance     8 rows  19 columns     │
│   Detected type: Porter Performance ✓           │
│                                                 │
│ ● Porter Idle Summary    8 rows  21 columns     │
│   Detected type: Idle Summary ✓                 │
│                                                 │
│              [Cancel]  [Start Validation →]     │
└─────────────────────────────────────────────────┘
```

---

### 4.3 Screen 3 — Validation Progress

Full-screen animated progress screen.

```
┌──────────────────────────────────────────┐
│                                          │
│   Validating your data...                │
│                                          │
│   ████████████████░░░░  68%              │
│                                          │
│   ✓ Parsing sheets                       │
│   ✓ Running cross-sheet checks           │
│   ✓ Validating Request Details           │
│   ⟳ Running AI anomaly detection...      │
│   ○ Generating report                    │
│                                          │
│   Found 3 critical issues so far         │
│                                          │
└──────────────────────────────────────────┘
```

---

### 4.4 Screen 4 — Validation Dashboard (Main Screen)

**Layout:** Two-panel on desktop. Full-width feed on mobile.

```
┌────────────────────────────────────────────────────────────────┐
│  ExcelAudit  /  BLK_Max_Hospital.xlsx         [Download Report]│
├────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ 23 Total │ │ 5 Crit.  │ │ 11 Med.  │ │ 7 Low  Score:62  │  │
│  │ Issues   │ │ 🔴       │ │ 🟡       │ │ 🔵             /100│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│  Filters: [All Sheets ▾] [All Severity ▾] [All Types ▾] [Search]│
├─────────────────────────────┬──────────────────────────────────┤
│  ISSUES FEED (left panel)   │  ISSUE DETAIL (right panel)      │
│                             │                                  │
│  ── Request Details (9) ──  │  [Issue detail shown here        │
│  ┌─────────────────────┐    │   when issue is clicked]         │
│  │🔴 CRITICAL          │    │                                  │
│  │ Duplicate Request ID│    │                                  │
│  │ Row 14, Row 89      │◄───│                                  │
│  │ requestid: 5681045  │    │                                  │
│  └─────────────────────┘    │                                  │
│  ┌─────────────────────┐    │                                  │
│  │🔴 CRITICAL          │    │                                  │
│  │ TAT Arithmetic Error│    │                                  │
│  │ Row 45              │    │                                  │
│  └─────────────────────┘    │                                  │
│  ┌─────────────────────┐    │                                  │
│  │🟡 MEDIUM            │    │                                  │
│  │ Whitespace in Name  │    │                                  │
│  │ "salma " → "salma"  │    │                                  │
│  └─────────────────────┘    │                                  │
│                             │                                  │
│  ── Location Summary (3) ── │                                  │
│  ┌─────────────────────┐    │                                  │
│  │🔴 CRITICAL          │    │                                  │
│  │ Cross-Sheet Mismatch│    │                                  │
│  └─────────────────────┘    │                                  │
└─────────────────────────────┴──────────────────────────────────┘
```

**Issue Card Design:**
```
┌──────────────────────────────────────────────────┐
│ 🔴 CRITICAL                    [Request Details] │
│                                                  │
│ TAT Arithmetic Error                             │
│ Accept→Arrive (00:04:12) + Arrive→Complete       │
│ (00:08:35) ≠ Accept→Complete (00:09:00)          │
│                                                  │
│ Row 45 · Cell P45, Q45, O45                      │
│                                                  │
│ 🤖 AI: The recorded total TAT is 3 minutes       │
│ shorter than the sum of its components.          │
│ Likely a manual override or data entry error.   │
│                                                  │
│ 🔧 Manual fix required in source system          │
│                               [Acknowledge ✓]   │
└──────────────────────────────────────────────────┘
```

---

### 4.5 Issue Detail Panel (Right Panel)

When an issue card is clicked, the right panel shows:

**For single-sheet issues:**
```
┌──────────────────────────────────────────┐
│ TAT Arithmetic Error          [×]        │
│ Request Details · Row 45 · CRITICAL      │
├──────────────────────────────────────────┤
│ Expected: 00:12:47                       │
│ Actual:   00:09:00                       │
│ Difference: -3 mins 47 sec               │
├──────────────────────────────────────────┤
│ Affected Data                            │
│ ┌──────┬──────────────┬───────────┐     │
│ │ Row  │ Column       │ Value     │     │
│ ├──────┼──────────────┼───────────┤     │
│ │  45  │ Accept→Arrive│ 00:04:12  │     │
│ │  45  │ Arrive→Comp. │ 00:08:35  │ ←🔴│
│ │  45  │ Accept→Comp. │ 00:09:00  │ ←🔴│
│ └──────┴──────────────┴───────────┘     │
├──────────────────────────────────────────┤
│ Request ID: 5681148                      │
│ Porter: salma                            │
│ Status: Completed                        │
│ Start: 2026-05-31 06:51:14               │
├──────────────────────────────────────────┤
│ AI Analysis                              │
│ The total TAT (Accept to Complete) is    │
│ 3 minutes 47 seconds less than the sum  │
│ of its component parts. This inconsist- │
│ ency may indicate a manual correction   │
│ or data entry override.                 │
│                                          │
│ Confidence: High                        │
├──────────────────────────────────────────┤
│ Remediation                              │
│ 🔧 Manual: Verify the original event    │
│ log timestamps in the source system     │
│ (porter management app). Recalculate    │
│ TAT from raw timestamps.               │
│                                          │
│                    [Acknowledge] [Close] │
└──────────────────────────────────────────┘
```

**For cross-sheet issues:**
```
┌──────────────────────────────────────────────────────┐
│ Cross-Sheet Count Mismatch                [×]        │
│ Date Summary ↔ Location Summary · CRITICAL          │
├──────────────────────────────────────────────────────┤
│ SHEET A: Date Summary                                │
│ ┌──────────────────┬───────┐                        │
│ │ Column           │ Value │                        │
│ ├──────────────────┼───────┤                        │
│ │ Total Requests   │  240  │ ←🔴 (should be 153)   │
│ └──────────────────┴───────┘                        │
│                                                      │
│ SHEET B: Location Summary (sum of all rows)          │
│ ┌──────────────────┬───────┐                        │
│ │ Location         │ Count │                        │
│ ├──────────────────┼───────┤                        │
│ │ 6th Floor        │  42   │                        │
│ │ 5th Floor        │  58   │                        │
│ │ 7th Floor        │  18   │                        │
│ │ 3rd Floor        │  35   │                        │
│ ├──────────────────┼───────┤                        │
│ │ SUM              │  153  │ ←🟢 Expected           │
│ └──────────────────┴───────┘                        │
│                                                      │
│ Discrepancy: 87 requests unaccounted for             │
│                                                      │
│ AI: The Date Summary shows 240 total requests but    │
│ only 153 appear in the Location Summary. The         │
│ remaining 87 may belong to floors not included in   │
│ the location report, or may be system/admin entries. │
└──────────────────────────────────────────────────────┘
```

---

## 5. Sheet Tab Navigation

Above the issue feed, a tab bar shows each sheet with its issue count badge:

```
[All (23)] [Request Details (9)] [Date Summary (4)] [Location Summary (3)]
[Pool Summary (2)] [Porter Performance (3)] [Idle Summary (2)]
```

Each tab has a color dot matching the sheet color system defined in Section 2.

---

## 6. Quality Score Widget

Displayed prominently in the summary bar:

```
┌─────────────────────┐
│  Data Quality Score │
│                     │
│       62            │
│      /100           │
│                     │
│  ████████░░░░░░░░   │
│  Needs Attention    │
└─────────────────────┘
```

Score calculation:
- Start at 100
- Deduct 10 points per Critical issue (capped at -50)
- Deduct 3 points per Medium issue (capped at -30)
- Deduct 1 point per Low issue (capped at -20)
- Display label: 90–100 = "Excellent", 70–89 = "Good", 50–69 = "Needs Attention", < 50 = "Poor"

---

## 7. Download Report Modal

```
┌───────────────────────────────────────────┐
│  Download Validation Report      [×]      │
├───────────────────────────────────────────┤
│  File: BLK_Max_Hospital.xlsx              │
│  Validated: 2026-06-01 14:32              │
│  Issues: 5 Critical · 11 Medium · 7 Low  │
│  Quality Score: 62/100                   │
├───────────────────────────────────────────┤
│  Format:                                  │
│  ○ PDF Report (recommended for sharing)  │
│  ○ Word Document (.docx)                 │
│                                           │
│  Include sections:                        │
│  ☑ Executive Summary                     │
│  ☑ Per-sheet issue details               │
│  ☑ Cross-sheet comparison table          │
│  ☑ Remediation guidance                  │
│  ☐ Full request detail rows (large)      │
│                                           │
│              [Cancel] [Download Report]   │
└───────────────────────────────────────────┘
```

---

## 8. Component Hierarchy

```
App
├── Header
│   └── FileNameBreadcrumb
├── SummaryBar
│   ├── IssueCountCard (x4: total, critical, medium, low)
│   └── QualityScoreWidget
├── FilterBar
│   ├── SheetTabNav
│   ├── SeverityFilter (dropdown)
│   ├── IssueTypeFilter (dropdown)
│   └── SearchInput
├── MainContent (split panel)
│   ├── IssueFeed (left, scrollable)
│   │   ├── SheetGroup (per sheet)
│   │   │   └── IssueCard (per issue)
│   └── IssueDetailPanel (right, conditional)
│       ├── IssueHeader
│       ├── ExpectedActualRow
│       ├── AffectedCellsTable (highlighted)
│       ├── CrossSheetComparison (if applicable)
│       ├── AIAnalysisBlock
│       └── RemediationBlock
└── DownloadReportModal
```

---

## 9. Responsive Design

| Breakpoint | Layout |
|-----------|--------|
| Desktop (≥1280px) | Two-panel: 40% feed / 60% detail |
| Tablet (768–1279px) | Single panel; detail opens as bottom drawer |
| Mobile (<768px) | Single panel; detail opens as full-screen overlay |

On mobile, the filter bar collapses into a "Filters" button that opens a bottom sheet.

---

## 10. Micro-interactions & Animations

| Event | Animation |
|-------|-----------|
| File drag over dropzone | Border turns indigo, background lightens, scale 102% |
| Validation progress | Smooth bar fill with step label transitions |
| Issue card click | Subtle scale + shadow on press; right panel slides in |
| Acknowledge toggle | Checkmark draws in; card opacity reduces to 60% |
| New issues appear | Fade-in from top with stagger (50ms per card) |
| Download button | Brief loading spinner, then success checkmark |
| Cross-sheet comparison | Both value cells pulse red simultaneously |

---

## 11. Empty & Error States

**No issues found:**
```
┌──────────────────────────────────┐
│                                  │
│   ✅                             │
│   No issues found!               │
│   Your data looks clean.         │
│   Quality Score: 100/100         │
│                                  │
│   [Download Clean Report]        │
│                                  │
└──────────────────────────────────┘
```

**AI service unavailable:**
- Banner: "AI analysis unavailable — showing rule-based findings only"
- Rule-based results still shown in full; no blocking

**Unrecognized sheet type:**
- Sheet tagged as "Unknown" in tab bar with a warning icon
- AI attempts to infer schema; if it can't, sheet is flagged with a single "Unrecognized sheet structure" notice

**File parse error:**
```
┌──────────────────────────────────┐
│  ⚠ Could not read this file     │
│                                  │
│  Possible reasons:               │
│  • File is password-protected    │
│  • File is corrupted             │
│  • File is not a valid Excel     │
│                                  │
│  [Try another file]              │
└──────────────────────────────────┘
```

---

## 12. PDF Report Design

**Cover Page:**
- Hospital icon + "ExcelAudit" title
- File name, validation date/time
- Quality Score (large, colored by score range)
- Issue count summary (Critical / Medium / Low)

**Executive Summary (Page 2):**
- AI-generated 4–5 sentence paragraph
- Top 3 most critical findings listed

**Per-Sheet Sections:**
- Sheet name as section header with color dot
- Issues as numbered list: Issue type, cell reference, expected vs. actual, remediation
- Each AI description limited to 3 lines

**Appendix — Cross-Sheet Comparison Table:**
| Check | Sheet A Value | Sheet B Value | Result |
|-------|--------------|--------------|--------|
| Total Requests | 240 | 153 | ❌ FAIL |
| Total Completed | 234 | 234 | ✅ PASS |
| TAT Average | 00:19:30 | 00:18:45 | ⚠ WARN |

**Footer on all pages:** File name · Validated on [date] · ExcelAudit

---

## 13. Accessibility

- All issue severity communicated with both color AND icon (not color alone)
- Keyboard navigation: Tab through issue cards, Enter to open detail panel, Escape to close
- Screen reader labels on all icon buttons
- WCAG AA contrast ratio on all text/background combinations
- Focus ring visible on all interactive elements

---

## 14. Design Tokens (Tailwind Config)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        critical: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
        medium:   { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
        low:      { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
        pass:     { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
        brand:    { DEFAULT: '#4F46E5', light: '#EEF2FF', dark: '#3730A3' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  }
}
```
