import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedWorkbook } from '../validator/types';

export interface SheetMapping {
  sheetType: string;
  columns: Record<string, string>;  // actualName -> concept
  isCountableSheet: boolean;
}

export interface WorkbookMapping {
  [actualSheetName: string]: SheetMapping;
}

const CONCEPT_PATTERNS: Record<string, string[]> = {
  total_requests: ['total requests', 'requests', 'total'],
  completed_count: ['completed', 'complete'],
  cancelled_count: ['cancelled', 'canceled', 'cancel'],
  rejected_count: ['rejected', 'reject'],
  waiting_count: ['waiting', 'waitlist', 'pending'],
  open_count: ['open'],
  start_time: ['start time', 'start', 'created', 'create time'],
  end_time: ['end time', 'end', 'completed time', 'finish'],
  total_duration: [
    'duration', 'tat', 'total time', 
    'create to complete', 'duration(create to complete)'
  ],
  create_to_accept: [
    'create to accept', 'tat:create to accept',
    'waiting duration', 'wait time'
  ],
  accept_to_arrive: [
    'accept to arrive', 'tat (accept to arrive)',
    'tat:accept to arrive'
  ],
  arrive_to_complete: [
    'arrive to complete', 'tat (arrive to complete)',
    'tat:arrive to complete'  
  ],
  accept_to_complete: [
    'accept to complete', 'tat (accept to complete)',
    'tat (assigned to complete)'
  ],
  request_id: ['requestid', 'request id', 'id', 'ticket id'],
  porter_name: ['name', 'porter name', 'staff name', 'employee'],
  porter_id: ['porter id', 'staff id', 'employee id'],
  pool_name: ['pool name', 'pool', 'team', 'group'],
  location: ['location', 'floor', 'ward', 'area'],
  row_type: ['type'],
  status: ['status'],
  comment: ['comment', 'comments', 'remarks', 'notes']
};

function heuristicMap(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach(header => {
    const h = header.toLowerCase().trim();
    let bestConcept = '';
    let longestMatch = 0;
    
    for (const [concept, patterns] of Object.entries(CONCEPT_PATTERNS)) {
      for (const p of patterns) {
        if (h.includes(p) && p.length > longestMatch) {
          bestConcept = concept;
          longestMatch = p.length;
        }
      }
    }
    if (bestConcept) {
      result[header] = bestConcept;
    }
  });
  return result;
}

export async function mapWorkbookColumns(
  parsedWorkbook: ParsedWorkbook
): Promise<WorkbookMapping> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  const sheetsInfo = parsedWorkbook.sheets.map(sheet => {
    return {
      sheetName: sheet.sheetName,
      headers: sheet.data.length > 0 ? Object.keys(sheet.data[0]) : [],
      sampleRows: sheet.data.slice(0, 2)
    };
  });

  if (!apiKey) {
    console.warn('No API key found for column mapping. Using heuristic fallback mapping.');
    const fallbackMapping: WorkbookMapping = {};
    for (const sheet of parsedWorkbook.sheets) {
      const headers = sheet.data.length > 0 ? Object.keys(sheet.data[0]) : [];
      fallbackMapping[sheet.sheetName] = {
        sheetType: 'unknown',
        columns: heuristicMap(headers),
        isCountableSheet: false
      };
    }
    return fallbackMapping;
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `
You are a hospital data analyst. You will receive column 
headers from different sheets of a hospital Excel report.

Your job is to identify the semantic meaning of each column 
and map them to these standard concepts:

COUNTABLE FIELDS (numeric counts):
- total_requests: total number of requests
- completed_count: number of completed requests  
- cancelled_count: number of cancelled requests
- rejected_count: number of rejected requests
- waiting_count: number of waiting/pending requests
- open_count: number of open requests
- porter_count: number of porters

TIME/DURATION FIELDS:
- start_time: when the request started/was created
- end_time: when the request ended/was completed
- total_duration: total time from create to complete
- create_to_accept: time from creation to acceptance
- accept_to_arrive: time from acceptance to arrival
- arrive_to_complete: time from arrival to completion
- accept_to_complete: time from acceptance to completion
- wait_time: waiting/queue time

IDENTITY FIELDS:
- request_id: unique request identifier
- porter_name: name of the porter
- porter_id: porter identifier
- pool_name: pool or group name
- location: floor or location name
- row_type: type indicator (Source/Destination)

STATUS FIELDS:
- status: request status (Completed/Cancelled/etc)
- comment: notes or comments field

SHEET TYPE:
Also identify what type of sheet this is:
- date_summary: daily aggregated summary
- location_summary: location-wise summary
- pool_summary: pool-wise summary  
- request_details: individual request rows
- porter_performance: porter-level metrics
- idle_summary: porter idle time data
- unknown: cannot determine

Analyze these Excel sheets from a hospital management system.
For each sheet, map the columns to standard concepts.

Sheets:
${JSON.stringify(sheetsInfo, null, 2)}

Return ONLY a JSON object where keys are actual sheet names and values 
are the mapping objects in this exact format:
{
  "actual_sheet_name": {
    "sheetType": "date_summary",
    "columns": {
      "actual_column_name_from_excel": "standard_concept",
      "Date": "start_time",
      "Total Requests": "total_requests"
    },
    "isCountableSheet": true
  }
}

Only map columns you are confident about.
Skip columns you cannot identify.
Never map string columns to countable concepts.
Return ONLY valid JSON, no markdown, no explanation.
  `;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini timeout')), 60000)
  );

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);
    const raw = result.response.text();
    const cleaned = raw
      .replace(/\\s*\`\`\`json/g, '')
      .replace(/\`\`\`/g, '')
      .trim();

    try {
      return JSON.parse(cleaned) as WorkbookMapping;
    } catch {
      console.error('Gemini mapping parse failed. Raw response:', raw);
      
      // Fallback
      const fallbackMapping: WorkbookMapping = {};
      for (const sheet of parsedWorkbook.sheets) {
        const headers = sheet.data.length > 0 ? Object.keys(sheet.data[0]) : [];
        fallbackMapping[sheet.sheetName] = {
          sheetType: 'unknown',
          columns: heuristicMap(headers),
          isCountableSheet: false
        };
      }
      return fallbackMapping;
    }
  } catch (error) {
    console.error('Column Mapping Error:', error);
    
    // Fallback
    const fallbackMapping: WorkbookMapping = {};
    for (const sheet of parsedWorkbook.sheets) {
      const headers = sheet.data.length > 0 ? Object.keys(sheet.data[0]) : [];
      fallbackMapping[sheet.sheetName] = {
        sheetType: 'unknown',
        columns: heuristicMap(headers),
        isCountableSheet: false
      };
    }
    return fallbackMapping;
  }
}

export function getColumnValue(
  row: Record<string, unknown>,
  concept: string,
  mapping: SheetMapping
): unknown {
  if (!mapping || !mapping.columns) return undefined;
  const actualColumn = Object.entries(mapping.columns)
    .find(([_, c]) => c === concept)?.[0];
  return actualColumn ? row[actualColumn] : undefined;
}

export function getColumnName(
  concept: string,
  mapping: SheetMapping  
): string | undefined {
  if (!mapping || !mapping.columns) return undefined;
  return Object.entries(mapping.columns)
    .find(([_, c]) => c === concept)?.[0];
}
