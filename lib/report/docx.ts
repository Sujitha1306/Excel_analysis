import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType, AlignmentType } from "docx";
import { ValidationReport, ValidationIssue } from "../validator/types";
import { ReportOptions } from "./pdf";

export async function generateDocxBuffer(report: ValidationReport, options: ReportOptions): Promise<Buffer> {
  const children: any[] = [];
  
  // COVER PAGE
  children.push(
    new Paragraph({
      text: "ExcelAudit",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      text: "Hospital Porter Management Data Validation",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "File: ", bold: true }),
        new TextRun(report.fileName)
      ],
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Validated On: ", bold: true }),
        new TextRun(new Date(report.validatedAt).toLocaleString())
      ],
      spacing: { after: 400 }
    })
  );

  // Quality Score
  const score = Math.round(report.qualityScore);
  let scoreColor = "991B1B"; // red
  if (score >= 90) scoreColor = "166534";
  else if (score >= 70) scoreColor = "1E40AF";
  else if (score >= 50) scoreColor = "92400E";

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Data Quality Score: ", size: 32, bold: true }),
        new TextRun({ text: `${score} / 100`, size: 48, bold: true, color: scoreColor })
      ],
      spacing: { after: 400 }
    }),
    new Paragraph({ text: "Issue Summary", heading: HeadingLevel.HEADING_2 })
  );

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Severity", bold: true })] })],
            shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Count", bold: true })] })],
            shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("Critical")] }),
          new TableCell({ children: [new Paragraph(report.criticalCount.toString())] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("Medium")] }),
          new TableCell({ children: [new Paragraph(report.mediumCount.toString())] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("Low")] }),
          new TableCell({ children: [new Paragraph(report.lowCount.toString())] })
        ]
      })
    ]
  });

  children.push(summaryTable);
  
  // PAGE 2: Executive Summary
  if (options.sections.executiveSummary && options.executiveSummaryText) {
    children.push(
      new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 200 } }),
      new Paragraph({ text: options.executiveSummaryText, spacing: { after: 400 } })
    );
  }

  // PAGE 3+: Per-Sheet Details
  if (options.sections.perSheetDetails && report.issues.length > 0) {
    children.push(
      new Paragraph({ text: "Per-Sheet Details", heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 200 } })
    );
    
    const issuesBySheet = report.issues.reduce((acc, issue) => {
      if (!acc[issue.sheetName]) acc[issue.sheetName] = [];
      acc[issue.sheetName].push(issue);
      return acc;
    }, {} as Record<string, ValidationIssue[]>);
    
    for (const [sheet, issues] of Object.entries(issuesBySheet)) {
      children.push(
        new Paragraph({ text: sheet, heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } })
      );
      
      const rows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Issue & Severity", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Cells", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Remediation", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } })
          ]
        })
      ];
      
      issues.forEach((i, idx) => {
        let cellRefs = i.affectedRows.slice(0, 5).map(r => `Row ${r.rowNumber}`).join(', ');
        if (i.affectedRows.length > 5) cellRefs += ` (+${i.affectedRows.length - 5} more)`;
        if (!cellRefs) cellRefs = 'N/A';
        const rem = options.sections.remediation ? i.remediationSuggestion : 'Omitted';
        
        rows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`${idx + 1}. ${i.issueType.replace(/_/g, ' ')}\n[${i.severity.toUpperCase()}]`)] }),
            new TableCell({ children: [new Paragraph(cellRefs)] }),
            new TableCell({ children: [new Paragraph(i.description)] }),
            new TableCell({ children: [new Paragraph(rem)] })
          ]
        }));
      });
      
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        rows
      }));
    }
  }

  // APPENDIX: Cross-Sheet Comparison
  if (options.sections.crossSheetComparison && report.crossSheetChecks && report.crossSheetChecks.length > 0) {
    children.push(
      new Paragraph({ text: "Appendix: Cross-Sheet Consistency", heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 200 } })
    );
    
    const rows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Rule ID", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Details", bold: true })] })], shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" } })
        ]
      })
    ];
    
    report.crossSheetChecks.forEach(c => {
      rows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(c.checkName)] }),
          new TableCell({ children: [new Paragraph(`${c.sheetA} vs ${c.sheetB}`)] }),
          new TableCell({ children: [new Paragraph({
            children: [
              new TextRun({ 
                text: c.passed ? 'PASS' : 'FAIL', 
                bold: true,
                color: c.passed ? "166534" : "991B1B"
              })
            ]
          })] }),
          new TableCell({ children: [new Paragraph(c.details || '')] })
        ]
      }));
    });
    
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
      rows
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  return await Packer.toBuffer(doc);
}
