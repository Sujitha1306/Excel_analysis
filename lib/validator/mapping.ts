import { ParsedWorkbook, ParsedSheet } from "./types";

export interface SheetMapping {
  sheetType: string;
  columns: Record<string, string>;
  isCountableSheet: boolean;
}

export type WorkbookMapping = Record<string, SheetMapping>;

export function getColumnValue(
  row: Record<string, unknown>,
  concept: string,
  mapping: SheetMapping
): unknown {
  const actualColumn = getColumnName(concept, mapping);
  const value = actualColumn ? row[actualColumn] : undefined;
  console.log(
    "Looking for concept:",
    concept,
    "Found column:",
    actualColumn,
    "Value:",
    actualColumn ? value : "NOT FOUND"
  );
  return value;
}

export function getColumnName(
  concept: string,
  mapping: SheetMapping
): string | undefined {
  return Object.entries(mapping.columns).find(([, c]) => c === concept)?.[0];
}

export function findSheetByType(
  workbook: ParsedWorkbook,
  mapping: WorkbookMapping,
  sheetType: string
): { sheet: ParsedSheet; mapping: SheetMapping } | null {
  for (const sheet of workbook.sheets) {
    const sheetMapping = mapping[sheet.sheetName];
    if (sheetMapping?.sheetType === sheetType) {
      return { sheet, mapping: sheetMapping };
    }
  }

  return null;
}
