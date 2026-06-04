import { describe, it, expect } from "vitest";
import { crossSheetRules } from "../../../lib/validator/rules/cross-sheet";
import { ParsedWorkbook } from "../../../lib/validator/types";
import { WorkbookMapping } from "../../../lib/validator/mapping";

function createMockWorkbook(sheets: any[]): ParsedWorkbook {
  return {
    fileName: "mock.xlsx",
    fileSize: 1000,
    sheets: sheets.map(s => ({
      sheetName: s.name,
      type: "unknown",
      rowCount: s.data.length,
      colCount: Object.keys(s.data[0] || {}).length,
      data: s.data
    }))
  };
}

describe("Cross-Sheet Rules", () => {
  it("flags mismatched totals across sheets", () => {
    const wb = createMockWorkbook([
      {
        name: "Date Summary",
        data: [{ "Total Requests": 100 }]
      },
      {
        name: "Pool Summary",
        data: [{ "Total Requests": 90 }]
      }
    ]);

    const mapping: WorkbookMapping = {
      "Date Summary": {
        sheetType: "date_summary",
        isCountableSheet: true,
        columns: { "Total Requests": "total_requests" }
      },
      "Pool Summary": {
        sheetType: "pool_summary",
        isCountableSheet: true,
        columns: { "Total Requests": "total_requests" }
      }
    };

    const result = crossSheetRules.run(wb, mapping);
    const issue = result.issues.find(i => i.issueType === "Count Mismatch Across Sheets");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("critical");
  });

  it("flags source vs destination mismatch in location summary", () => {
    const wb = createMockWorkbook([
      {
        name: "Location Summary",
        data: [
          { Type: "Source", Requested: 10 },
          { Type: "Destination", Requested: 8 }
        ]
      }
    ]);

    const mapping: WorkbookMapping = {
      "Location Summary": {
        sheetType: "location_summary",
        isCountableSheet: true,
        columns: {
          Type: "row_type",
          Requested: "total_requests"
        }
      }
    };

    const result = crossSheetRules.run(wb, mapping);
    const issue = result.issues.find(i => i.issueType === "Count Mismatch Across Sheets");
    expect(issue).toBeDefined();
  });
});
