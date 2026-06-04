import { NextResponse } from "next/server";
import { ParsedWorkbook, ValidationReport } from "@/lib/validator/types";
import { mapWorkbookColumns } from "@/lib/ai/columnMapper";
import { crossSheetRules } from "@/lib/validator/rules/cross-sheet";
import { requestDetailsRules } from "@/lib/validator/rules/request-details";
import { dataQualityRules } from "@/lib/validator/rules/data-quality";
import { calculateQualityScore } from "@/lib/validator/score";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const workbook = (await req.json()) as ParsedWorkbook;

    if (!workbook || !Array.isArray(workbook.sheets)) {
      return NextResponse.json({ error: "Invalid workbook payload" }, { status: 400 });
    }

    const workbookMapping = await mapWorkbookColumns(workbook);
    console.log("MAPPING RESULT:", JSON.stringify(workbookMapping, null, 2));

    const crossSheetResult = crossSheetRules.run(workbook, workbookMapping);
    console.log("Issues found by rule cross-sheet-rules:", crossSheetResult.issues.length);

    const requestDetailsResult = requestDetailsRules.run(workbook, workbookMapping);
    console.log("Issues found by rule request-details-rules:", requestDetailsResult.issues.length);

    const dataQualityResult = dataQualityRules.run(workbook, workbookMapping);
    console.log("Issues found by rule data-quality-rules:", dataQualityResult.issues.length);

    const issues = [
      ...crossSheetResult.issues,
      ...requestDetailsResult.issues,
      ...dataQualityResult.issues
    ];

    const report: ValidationReport = {
      fileName: workbook.fileName,
      validatedAt: new Date(),
      totalIssues: issues.length,
      criticalCount: issues.filter(i => i.severity === "critical").length,
      mediumCount: issues.filter(i => i.severity === "medium").length,
      lowCount: issues.filter(i => i.severity === "low").length,
      qualityScore: 0,
      issues,
      sheetsAnalyzed: workbook.sheets.map(s => s.sheetName),
      crossSheetChecks: crossSheetResult.crossSheetChecks || []
    };

    report.qualityScore = calculateQualityScore(report);

    const totalRowsProcessed = workbook.sheets.reduce((sum, sheet) => sum + sheet.data.length, 0);

    return NextResponse.json({
      ...report,
      _debug: {
        mappingReceived: workbookMapping,
        ruleResults: {
          crossSheet: crossSheetResult.issues.length,
          requestDetails: requestDetailsResult.issues.length,
          dataQuality: dataQualityResult.issues.length
        },
        totalRowsProcessed
      }
    });
  } catch (error: any) {
    console.error("Validation debug error:", error);
    return NextResponse.json({ error: "Failed to validate workbook" }, { status: 500 });
  }
}
