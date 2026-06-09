import { NextResponse } from 'next/server';
import { AzureOpenAI } from 'openai';
import { generatePdfBuffer } from '@/lib/report/pdf';
import { generateDocxBuffer } from '@/lib/report/docx';

// Use Edge runtime if possible, but jsPDF/docx might prefer Node
// We will stick to Node runtime since jsPDF and docx use buffer/fs sometimes
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60 seconds

// Removed genAI global instantiation

// Basic in-memory rate limiting (IP -> count & timestamp)
// Note: In Vercel serverless, this only persists per-container, 
// but satisfies the "basic" security hardening requirement.
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    const rateLimit = rateLimitMap.get(ip);
    
    if (rateLimit && rateLimit.resetAt > now) {
      if (rateLimit.count >= 10) { // Max 10 reports per minute
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
      rateLimit.count += 1;
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    }

    // 2. Parse payload
    const body = await req.json();
    const { report, format, sections } = body;

    if (!report || !format) {
      return NextResponse.json({ error: 'Missing report or format parameter' }, { status: 400 });
    }

    // 3. Generate Executive Summary if requested
    let executiveSummaryText = '';
    
    if (sections.executiveSummary) {
      if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
        executiveSummaryText = "Azure OpenAI keys not configured. Executive summary generation bypassed.";
      } else {
        try {
          const client = new AzureOpenAI({
            endpoint: process.env.AZURE_OPENAI_ENDPOINT,
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            apiVersion: "2024-02-15-preview"
          });
          const prompt = `
You are a Data Quality Analyst. Review the following validation report metrics and generate a concise 4-5 sentence executive summary for the hospital management. Highlight the overall quality score, the severity distribution, and the top 2-3 most critical issues.
Data:
Quality Score: ${report.qualityScore}
Critical Issues: ${report.criticalCount}
Medium Issues: ${report.mediumCount}
Low Issues: ${report.lowCount}
Total Issues: ${report.totalIssues}
Top Issues Data: ${JSON.stringify(report.issues.slice(0, 5))}
`;
          const result = await client.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            messages: [{ role: 'user', content: prompt }]
          });
          executiveSummaryText = result.choices[0].message.content || '';
        } catch (e) {
          console.error("Azure OpenAI summary failed:", e);
          executiveSummaryText = "Failed to generate AI summary due to an API error.";
        }
      }
    }

    const options = { sections, executiveSummaryText };

    // 4. Generate file buffer
    let buffer: Buffer;
    let contentType = '';
    let ext = '';

    if (format === 'pdf') {
      buffer = generatePdfBuffer(report, options);
      contentType = 'application/pdf';
      ext = 'pdf';
    } else if (format === 'docx') {
      buffer = await generateDocxBuffer(report, options);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      ext = 'docx';
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    // 5. Return as Downloadable Blob
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="ExcelAudit_Report_${report.fileName}.${ext}"`
      }
    });

  } catch (err: any) {
    console.error("Report generation error:", err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
