import { NextRequest, NextResponse } from 'next/server';
import { enrichValidationReport } from '../../../lib/ai/enrichment';
import { ValidationReport } from '../../../lib/validator/types';
import { ValidationReportSchema } from './schema';

// Basic in-memory rate limiting (IP -> count & timestamp)
const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    // 1. Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    const rateLimit = rateLimitMap.get(ip);
    
    if (rateLimit && rateLimit.resetAt > now) {
      if (rateLimit.count >= 20) { // Max 20 enrichments per minute
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
      rateLimit.count += 1;
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    }

    body = await req.json();
    
    // 2. Zod Schema Validation
    const parseResult = ValidationReportSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid ValidationReport payload.', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const report = body as ValidationReport;
    try {
      const enrichedData = await enrichValidationReport(report);
      return NextResponse.json({
        ...report,
        aiAvailable: true,
        enrichedIssues: enrichedData.enrichedIssues,
        summary: enrichedData.summary
      });
    } catch (enrichmentError) {
      console.error('Gemini API failed:', enrichmentError);
      return NextResponse.json({
        ...report,
        aiAvailable: false
      });
    }
  } catch (error: any) {
    console.error('API /ai-validate fatal error:', error);
    // Never crash: if body was parsed, return it, otherwise return a minimal fallback.
    const fallback = body ? body : { issues: [], totalIssues: 0 };
    return NextResponse.json({
      ...fallback,
      aiAvailable: false
    });
  }
}

