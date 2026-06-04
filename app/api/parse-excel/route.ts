import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { detectSheetType } from '@/lib/validator/sheet-detector';
import { ParsedWorkbook, ParsedSheet } from '@/lib/validator/types';

export const dynamic = 'force-dynamic';

function normalizeKeys(row: any): any {
  if (typeof row !== 'object' || row === null) return row;
  const normalized: any = {};
  for (const key of Object.keys(row)) {
    const newKey = key.trim().toLowerCase();
    normalized[newKey] = row[key];
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    
    // Parse using server-side SheetJS
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellStyles: true });
    
    const parsedSheets: ParsedSheet[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      const rawDataArray = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, blankrows: false });
      
      if (rawDataArray.length === 0) {
        continue;
      }

      let headerRowIndex = 0;
      let headers: any[] = [];
      
      for (let i = 0; i < Math.min(rawDataArray.length, 10); i++) {
        const row = rawDataArray[i];
        if (Array.isArray(row) && row.filter(val => typeof val === 'string' && val.trim().length > 0).length >= 3) {
          headerRowIndex = i;
          headers = row;
          break;
        }
      }

      const sheetType = detectSheetType(headers);

      const jsonRows = XLSX.utils.sheet_to_json<any>(worksheet, {
        range: headerRowIndex,
        defval: null,
        blankrows: false
      });

      const normalizedRows = jsonRows.map(normalizeKeys);
      const colCount = headers.length || (normalizedRows[0] ? Object.keys(normalizedRows[0]).length : 0);

      parsedSheets.push({
        sheetName,
        type: sheetType,
        rowCount: normalizedRows.length,
        colCount,
        data: normalizedRows,
      });
    }

    const parsedWorkbook: ParsedWorkbook = {
      fileName: file.name,
      fileSize: file.size,
      sheets: parsedSheets,
    };

    return NextResponse.json(parsedWorkbook, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('SheetJS parse error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to parse Excel file',
        detail: error.message,
        suggestion: 'Please ensure the file is a valid .xlsx or .xls file and is not password protected'
      },
      { status: 400 }
    );
  }
}
