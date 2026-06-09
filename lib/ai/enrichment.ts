import { AzureOpenAI } from 'openai';
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
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  if (!apiKey || !endpoint || !deployment) {
    console.warn('No Azure OpenAI keys found, falling back to basic rule output.');
    return generateFallback(report);
  }

  const client = new AzureOpenAI({
    endpoint: endpoint,
    apiKey: apiKey,
    deployment: deployment,
    apiVersion: "2024-02-15-preview"
  });

  try {
    // Deduplicate by issueType to avoid massive payload size errors (e.g. 10MB limit)
    // We only need the AI to enrich each *type* of issue, not every single row!
    const uniqueIssues: any[] = [];
    const seenTypes = new Set();
    for (const issue of report.issues) {
      if (!seenTypes.has(issue.issueType)) {
        seenTypes.add(issue.issueType);
        uniqueIssues.push({
          id: issue.id,
          severity: issue.severity,
          issueType: issue.issueType,
          description: issue.description
        });
      }
    }

    const prompt = `You are a medical data auditor analyzing a hospital porter dataset validation report.
You must provide natural language enrichments for the issues found.

Here are the UNIQUE issue types found:
${JSON.stringify(uniqueIssues, null, 2)}

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
      setTimeout(() => reject(new Error('Azure OpenAI timeout')), 60000)
    );

    const result = await Promise.race([
      client.chat.completions.create({
        model: deployment,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      }),
      timeoutPromise
    ]) as any;
    
    const responseText = result.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);
    
    // Map the unique enrichments back to ALL original issues
    const typeToEnrichment = new Map();
    for (const en of parsed.enrichedIssues || []) {
      const originalIssue = uniqueIssues.find(u => u.id === en.id);
      if (originalIssue) {
        typeToEnrichment.set(originalIssue.issueType, en);
      }
    }

    const fullEnrichedIssues = report.issues.map(i => {
      const aiData = typeToEnrichment.get(i.issueType);
      if (aiData) {
        return {
          id: i.id,
          aiDescription: aiData.aiDescription,
          aiRemediation: aiData.aiRemediation,
          confidence: aiData.confidence
        };
      }
      // Fallback if AI missed this type
      return {
        id: i.id,
        aiDescription: `🤖 ${i.description}`,
        aiRemediation: i.remediationSuggestion || 'Manual review required',
        confidence: 'medium' as const
      };
    });

    return {
      summary: parsed.summary || "Validation complete.",
      enrichedIssues: fullEnrichedIssues
    } as EnrichmentResult;
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
