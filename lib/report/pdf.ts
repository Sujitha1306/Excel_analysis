import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ValidationReport, ValidationIssue } from "../validator/types";

export interface ReportOptions {
  sections: {
    executiveSummary: boolean;
    perSheetDetails: boolean;
    crossSheetComparison: boolean;
    remediation: boolean;
  };
  executiveSummaryText?: string;
}

export function generatePdfBuffer(report: ValidationReport, options: ReportOptions): Buffer {
  const doc = new jsPDF();
  
  // Helpers
  const setNormal = (size: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); };
  const setBold = (size: number) => { doc.setFont("helvetica", "bold"); doc.setFontSize(size); };
  
  // COVER PAGE
  setBold(24);
  doc.text("ExcelAudit", 20, 40);
  
  setNormal(14);
  doc.text("Hospital Porter Management Data Validation", 20, 50);
  
  setNormal(12);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`File: ${report.fileName}`, 20, 70);
  doc.text(`Validated On: ${new Date(report.validatedAt).toLocaleString()}`, 20, 80);
  
  // Quality Score
  setBold(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("Data Quality Score:", 20, 110);
  
  const score = Math.round(report.qualityScore);
  setBold(48);
  
  if (score >= 90) {
    doc.setTextColor(22, 101, 52); // green #166534
  } else if (score >= 70) {
    doc.setTextColor(30, 64, 175); // blue #1E40AF
  } else if (score >= 50) {
    doc.setTextColor(146, 64, 14); // amber #92400E
  } else {
    doc.setTextColor(153, 27, 27); // red #991B1B
  }
  
  doc.text(`${score} / 100`, 20, 130);
  
  // Reset color
  doc.setTextColor(15, 23, 42); 
  
  setBold(14);
  doc.text("Issue Summary", 20, 160);
  
  autoTable(doc, {
    startY: 170,
    head: [['Severity', 'Count']],
    body: [
      ['Critical', report.criticalCount.toString()],
      ['Medium', report.mediumCount.toString()],
      ['Low', report.lowCount.toString()]
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] } // indigo-600
  });

  // PAGE 2: Executive Summary
  if (options.sections.executiveSummary && options.executiveSummaryText) {
    doc.addPage();
    setBold(18);
    doc.text("Executive Summary", 20, 20);
    
    setNormal(12);
    // Split text to fit width
    const lines = doc.splitTextToSize(options.executiveSummaryText, 170);
    doc.text(lines, 20, 35);
  }

  // PAGE 3+: Per-Sheet Details
  if (options.sections.perSheetDetails && report.issues.length > 0) {
    doc.addPage();
    setBold(18);
    doc.text("Per-Sheet Details", 20, 20);
    
    let yPos = 35;
    
    const issuesBySheet = report.issues.reduce((acc, issue) => {
      if (!acc[issue.sheetName]) acc[issue.sheetName] = [];
      acc[issue.sheetName].push(issue);
      return acc;
    }, {} as Record<string, ValidationIssue[]>);
    
    for (const [sheet, issues] of Object.entries(issuesBySheet)) {
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      
      setBold(14);
      doc.setTextColor(79, 70, 229);
      doc.text(sheet, 20, yPos);
      doc.setTextColor(15, 23, 42);
      yPos += 10;
      
      const tableData = issues.map((i, idx) => {
        let cellRefs = i.affectedRows.slice(0, 5).map(r => `Row ${r.rowNumber}`).join(', ');
        if (i.affectedRows.length > 5) cellRefs += ` (+${i.affectedRows.length - 5} more)`;
        if (!cellRefs) cellRefs = 'N/A';
        
        const rem = options.sections.remediation ? i.remediationSuggestion : 'Omitted';
        
        return [
          `${idx + 1}. ${i.issueType} [${i.severity.toUpperCase()}]`,
          cellRefs,
          i.description,
          rem
        ];
      });
      
      autoTable(doc, {
        startY: yPos,
        head: [['Issue & Severity', 'Rows', 'Description', 'Remediation']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 55 },
          3: { cellWidth: 50 }
        }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
  }

  // APPENDIX: Cross-Sheet Comparison
  if (options.sections.crossSheetComparison && report.crossSheetChecks && report.crossSheetChecks.length > 0) {
    doc.addPage();
    setBold(18);
    doc.text("Appendix: Cross-Sheet Consistency", 20, 20);
    
    const crossTable = report.crossSheetChecks.map(c => [
      c.checkName,
      `${c.sheetA} vs ${c.sheetB}`,
      c.passed ? 'PASS' : 'FAIL',
      c.details || ''
    ]);
    
    autoTable(doc, {
      startY: 35,
      head: [['Rule ID', 'Description', 'Status', 'Details']],
      body: crossTable,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] }, // slate-600
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'PASS') {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
  }

  // Add footers to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setNormal(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`File: ${report.fileName} · Validated On: ${new Date(report.validatedAt).toLocaleDateString()} · ExcelAudit`, 20, 290);
    doc.text(`Page ${i} of ${pageCount}`, 180, 290);
  }

  // Convert to Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
