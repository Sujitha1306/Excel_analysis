import { GoogleGenerativeAI } from '@google/generative-ai';
import { ValidationReport } from '../validator/types';

// The GoogleGenerativeAI initialization happens inside the function
// so it can dynamically pick up process.env without breaking at build time if undefined.

export interface EnrichedIssue {
  id: string;
  aiDescription: string;
  aiRemediation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EnrichmentResult {
  summary: string;
  enrichedIssues: EnrichedIssue[];
}

export async function enrichValidationReport(report: ValidationReport): Promise<EnrichmentResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY; // For flexibility
  if (!apiKey) {
    console.warn('No GEMINI_API_KEY found, falling back to basic rule output.');
    return generateFallback(report);
  }

  const ai = new GoogleGenerativeAI(apiKey);

  try {
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });
    
    // We only send the issues, not the full file data to respect privacy/security
    const issuesPayload = report.issues.map(i => ({
      id: i.id,
      severity: i.severity,
      issueType: i.issueType,
      description: i.description
    }));

    const prompt = `You are a medical data auditor analyzing a hospital porter dataset validation report.
You must provide natural language enrichments for the issues found.

Here are the issues:
${JSON.stringify(issuesPayload, null, 2)}

Respond ONLY with a JSON object matching this schema:
{
  "summary": "A 2-3 sentence overall summary of the report quality.",
  "enrichedIssues": [
    {
      "id": "match the issue id from the input",
      "aiDescription": "natural language explanation of what this means practically in a hospital",
      "aiRemediation": "how a human data entry clerk or manager should fix this step by step",
      "confidence": "high" // high, medium, or low
    }
  ]
}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), 60000)
    );

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    
    return parsed as EnrichmentResult;
  } catch (error) {
    console.error('AI Enrichment Error:', error);
    return generateFallback(report);
  }
}

function generateFallback(report: ValidationReport): EnrichmentResult {
  return {
    summary: "AI enrichment is currently unavailable. Displaying raw rule-based findings.",
    enrichedIssues: report.issues.map(i => ({
      id: i.id,
      aiDescription: `🤖 ${i.description}`,
      aiRemediation: i.remediationSuggestion,
      confidence: 'medium'
    }))
  };
}
