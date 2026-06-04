import ExcelJS from 'exceljs';
import { ValidationReport, Severity } from '../validator/types';

interface RowError {
  severity: Set<Severity>;
  notes: string[];
}

function buildRowErrorMap(
  report: ValidationReport
): Map<string, Map<number, RowError>> {
  const map = new Map<string, Map<number, RowError>>();

  report.issues.forEach(issue => {
    // Skip summary-level issues (rowNumber = 0 or "Summary level" string depending on how it's stored)
    issue.affectedRows
      .filter(ar => typeof ar.rowNumber === 'number' && ar.rowNumber > 0)
      .forEach(ar => {
        if (!map.has(issue.sheetName)) {
          map.set(issue.sheetName, new Map());
        }
        const sheetMap = map.get(issue.sheetName)!;
        
        const rowNum = ar.rowNumber as number;

        if (!sheetMap.has(rowNum)) {
          sheetMap.set(rowNum, {
            severity: new Set(),
            notes: []
          });
        }
        
        const rowError = sheetMap.get(rowNum)!;
        rowError.severity.add(issue.severity);
        
        // Build note
        const note = `[${issue.issueType.toUpperCase()}] ` +
          `Column "${ar.columnName}": ` +
          `Found "${ar.actualValue}" — ` +
          `Expected "${ar.expectedValue ?? 'valid value'}". ` +
          `${issue.condition}`;
        
        // Avoid duplicate notes
        if (!rowError.notes.includes(note)) {
          rowError.notes.push(note);
        }
      });
  });

  return map;
}

function determineHighlightColor(severities: Set<Severity>): string {
  if (severities.size > 1) return 'FFFFD700'; // Orange for multiple
  
  const sev = Array.from(severities)[0];
  switch (sev) {
    case 'critical': return 'FFFFC7CE'; // Mild red
    case 'medium':   return 'FFFFFFCC'; // Yellow
    case 'low':      return 'FFCCE5FF'; // Light blue
    default:         return 'FFFFFFFF'; // White
  }
}

// Helper: convert column number to letter
function getColumnLetter(colNumber: number): string {
  let result = '';
  while (colNumber > 0) {
    const remainder = (colNumber - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    colNumber = Math.floor((colNumber - 1) / 26);
  }
  return result;
}

export async function annotateExcel(
  originalBuffer: any,
  report: ValidationReport
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(originalBuffer);
  
  const rowErrorMap = buildRowErrorMap(report);

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    const sheetErrors = rowErrorMap.get(sheetName);
    
    if (!sheetErrors || sheetErrors.size === 0) return;

    // STEP 1: Find the last column to add Validation Notes
    const lastCol = worksheet.columnCount + 1;
    
    // Add header for validation notes column
    const headerRow = worksheet.getRow(1);
    const notesCell = headerRow.getCell(lastCol);
    notesCell.value = 'Validation Notes';
    notesCell.font = { bold: true, color: { argb: 'FF000000' } };
    notesCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }  // light gray header
    };
    notesCell.alignment = { wrapText: true };
    headerRow.commit();

    // STEP 2: Set column width for notes column
    worksheet.getColumn(lastCol).width = 60;

    // STEP 3: Annotate each error row
    sheetErrors.forEach((rowError, rowNumber) => {
      const row = worksheet.getRow(rowNumber);
      const highlightColor = determineHighlightColor(rowError.severity);
      
      // Highlight ALL cells in the row
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: highlightColor }
        };
      });

      // Add validation notes in the new column
      const rNotesCell = row.getCell(lastCol);
      rNotesCell.value = rowError.notes.join('\n\n');
      rNotesCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: highlightColor }
      };
      rNotesCell.alignment = { 
        wrapText: true, 
        vertical: 'top' 
      };
      rNotesCell.font = { 
        color: { argb: 'FF000000' },
        size: 9
      };

      row.commit();
    });

    // STEP 4: Add a legend on each annotated sheet
    const lastDataRow = worksheet.rowCount + 2;
    
    const legendTitle = worksheet.getRow(lastDataRow);
    legendTitle.getCell(1).value = 'VALIDATION LEGEND:';
    legendTitle.getCell(1).font = { bold: true };
    legendTitle.commit();

    const legends = [
      { color: 'FFFFC7CE', label: 'Critical Error' },
      { color: 'FFFFFFCC', label: 'Medium Error' },
      { color: 'FFCCE5FF', label: 'Low Error' },
      { color: 'FFFFD700', label: 'Multiple Errors' }
    ];

    legends.forEach((leg, i) => {
      const legendRow = worksheet.getRow(lastDataRow + 1 + i);
      const colorCell = legendRow.getCell(1);
      colorCell.value = '     ';  // empty cell with color
      colorCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: leg.color }
      };
      legendRow.getCell(2).value = leg.label;
      legendRow.commit();
    });
  });

  // Return as buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
