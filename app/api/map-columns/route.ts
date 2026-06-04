import { NextResponse } from "next/server";
import { mapWorkbookColumns } from "@/lib/ai/columnMapper";
import { ParsedWorkbook } from "@/lib/validator/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const workbook = (await req.json()) as ParsedWorkbook;

    if (!workbook || !Array.isArray(workbook.sheets)) {
      return NextResponse.json({ error: "Invalid workbook payload" }, { status: 400 });
    }

    const mapping = await mapWorkbookColumns(workbook);

    return NextResponse.json(mapping, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache"
      }
    });
  } catch (error: any) {
    console.error("Column mapping error:", error);
    return NextResponse.json({ error: "Failed to map columns" }, { status: 500 });
  }
}
