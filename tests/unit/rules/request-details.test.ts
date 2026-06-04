import { describe, it, expect } from "vitest";
import { requestDetailsRules } from "../../../lib/validator/rules/request-details";
import { ParsedWorkbook } from "../../../lib/validator/types";
import { WorkbookMapping } from "../../../lib/validator/mapping";

function createMockWorkbook(data: any[]): ParsedWorkbook {
  return {
    fileName: "mock.xlsx",
    fileSize: 1000,
    sheets: [
      {
        sheetName: "Request Details",
        type: "unknown",
        rowCount: data.length,
        colCount: Object.keys(data[0] || {}).length,
        data
      }
    ]
  };
}

describe("Request Details Rules", () => {
  const mapping: WorkbookMapping = {
    "Request Details": {
      sheetType: "request_details",
      isCountableSheet: false,
      columns: {
        "Request ID": "request_id",
        Status: "status",
        "Start Time": "start_time",
        "End Time": "end_time",
        Duration: "total_duration",
        "Create to Accept": "create_to_accept",
        "Accept to Arrive": "accept_to_arrive",
        "Arrive to Complete": "arrive_to_complete",
        Comment: "comment"
      }
    }
  };

  it("flags duplicate request IDs", () => {
    const wb = createMockWorkbook([
      { "Request ID": "R1" },
      { "Request ID": "R1" },
      { "Request ID": "R1" }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Duplicate Request ID")).toBe(true);
  });

  it("flags zero duration on completed requests", () => {
    const wb = createMockWorkbook([
      { "Request ID": "R1", Status: "Completed", Duration: "00:00:00" }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "TAT/Duration Zero on Completed Request")).toBe(true);
  });

  it("flags negative duration", () => {
    const wb = createMockWorkbook([
      { "Request ID": "R1", "Start Time": "10:00:00", "End Time": "09:00:00" }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Negative Duration")).toBe(true);
  });

  it("flags duration mismatch", () => {
    const wb = createMockWorkbook([
      { "Request ID": "R1", "Start Time": "10:00:00", "End Time": "10:30:00", Duration: "00:10:00" }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Duration Mismatch")).toBe(true);
  });

  it("flags TAT components mismatch", () => {
    const wb = createMockWorkbook([
      {
        "Request ID": "R1",
        Status: "Completed",
        Duration: "00:30:00",
        "Create to Accept": "00:05:00",
        "Accept to Arrive": "00:05:00",
        "Arrive to Complete": "00:05:00"
      }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "TAT Components Don't Sum to Total")).toBe(true);
  });

  it("flags partial TAT with completed status", () => {
    const wb = createMockWorkbook([
      {
        "Request ID": "R1",
        Status: "Completed",
        "Create to Accept": "00:05:00",
        "Accept to Arrive": "00:00:00",
        "Arrive to Complete": "00:00:00",
        Comment: "Needs review"
      }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Partial TAT with Completed Status")).toBe(true);
  });

  it("flags invalid status values", () => {
    const wb = createMockWorkbook([
      { "Request ID": "R1", Status: "Unknown" }
    ]);

    const { issues } = requestDetailsRules.run(wb, mapping);
    expect(issues.some(i => i.issueType === "Invalid Status Value")).toBe(true);
  });
});
