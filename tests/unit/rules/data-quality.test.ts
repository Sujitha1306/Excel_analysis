import { describe, it, expect } from "vitest";
import { dataQualityRules } from "../../../lib/validator/rules/data-quality";
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

describe("Data Quality Rules", () => {
  it("flags missing required fields and whitespace", () => {
    const wb = createMockWorkbook([
      {
        name: "Request Details",
        data: [
          { "Porter Name": " Alice ", "Request ID": "R1", Status: "Completed" },
          { "Porter Name": "", "Request ID": "", Status: "" }
        ]
      }
    ]);

    const mapping: WorkbookMapping = {
      "Request Details": {
        sheetType: "request_details",
        isCountableSheet: false,
        columns: {
          "Porter Name": "porter_name",
          "Request ID": "request_id",
          Status: "status"
        }
      }
    };

    const { issues } = dataQualityRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Missing Required Fields")).toBe(true);
    expect(issues.some(i => i.issueType === "Whitespace in Name Fields")).toBe(true);
  });

  it("flags porter ID mapped to different names", () => {
    const wb = createMockWorkbook([
      {
        name: "Porter Performance",
        data: [{ "Porter ID": "P1", "Porter Name": "John Doe" }]
      },
      {
        name: "Request Details",
        data: [{ "Porter ID": "P1", "Porter Name": "Johnny Doe" }]
      }
    ]);

    const mapping: WorkbookMapping = {
      "Porter Performance": {
        sheetType: "porter_performance",
        isCountableSheet: false,
        columns: {
          "Porter ID": "porter_id",
          "Porter Name": "porter_name"
        }
      },
      "Request Details": {
        sheetType: "request_details",
        isCountableSheet: false,
        columns: {
          "Porter ID": "porter_id",
          "Porter Name": "porter_name"
        }
      }
    };

    const { issues } = dataQualityRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Porter ID Maps to Different Names")).toBe(true);
  });

  it("flags statistical outliers by pool", () => {
    const poolRows = Array.from({ length: 12 }, () => ({ Pool: "A", Duration: "00:10:00" }));
    poolRows.push({ Pool: "A", Duration: "05:00:00" });

    const wb = createMockWorkbook([
      {
        name: "Request Details",
        data: poolRows
      }
    ]);

    const mapping: WorkbookMapping = {
      "Request Details": {
        sheetType: "request_details",
        isCountableSheet: false,
        columns: {
          Pool: "pool_name",
          Duration: "total_duration"
        }
      }
    };

    const { issues } = dataQualityRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Statistical TAT Outlier")).toBe(true);
  });
});
