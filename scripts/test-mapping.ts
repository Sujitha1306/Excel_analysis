import { AzureOpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8');
  // Simple env parser for test script
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
    }
  });
} catch (e) { }

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: "2024-02-15-preview"
});

// Test with exact headers from BLK_Max_Hospital
const testSheets = [
  {
    sheetName: "Sheet1", // date summary
    headers: [
      "Date", "Total Porters", "Requests", "Self",
      "Completed", "Open", "Waitlist", "Rejected",
      "Cancelled", "TAT: CREATE To COMPLETE",
      "TAT:CREATE TO ACCEPT", "TAT:ACCEPT TO ARRIVE",
      "TAT:ARRIVE TO COMPLETE", "TAT:SELF"
    ],
    sampleRows: [
      {
        "Date": "2026-05-31", "Total Porters": 8,
        "Requests": 240, "Completed": 234,
        "Cancelled": 6, "TAT: CREATE To COMPLETE": "00:19:30"
      }
    ]
  },
  {
    sheetName: "Sheet2", // location summary  
    headers: [
      "Type", "Location", "Requested", "Completed",
      "Rejected", "Cancelled", "Avg.TAT", "Total time"
    ],
    sampleRows: [
      {
        "Type": "Source", "Location": "6th floor",
        "Requested": 42, "Completed": 38,
        "Cancelled": 4
      }
    ]
  },
  {
    sheetName: "Sheet3", // pool summary
    headers: [
      "Pool Name", "Porters", "Shifts", "Total Requests",
      "Tickets completed", "Cancelled", "Open",
      "No Responses", "Rejected", "Waitlist",
      "TAT: Create To Complete", "TAT: Create To Accept"
    ],
    sampleRows: [
      {
        "Pool Name": "Inpatient(Transport)", "Porters": 5,
        "Total Requests": 172, "Tickets completed": 170
      }
    ]
  }
]

const prompt = `
You are a hospital data analyst. Analyze these Excel sheets 
from a hospital porter management system.

Map ONLY columns that contain COUNT/NUMBER data to these 
standard concepts. Be very precise.

COUNTING CONCEPTS (only for numeric count columns):
- total_requests: total number of service requests
- completed_count: number of completed requests
- cancelled_count: number of cancelled/abandoned requests  
- rejected_count: number of rejected requests
- waiting_count: number of requests currently waiting
- open_count: number of open/active requests
- porter_count: number of porters/staff

TIME/DURATION CONCEPTS (for time columns):
- start_time: request creation/start datetime
- end_time: request completion datetime
- total_duration: total time from create to complete
- create_to_accept: time from create to acceptance
- accept_to_arrive: time from accept to arrival
- arrive_to_complete: time from arrival to completion
- accept_to_complete: time from accept to completion

IMPORTANT RULES:
1. "Waitlist" is NOT the same as total_requests
2. "Tickets completed" and "Completed" mean completed_count
3. Only map a column if you are 100% certain of its meaning
4. If unsure, do not map it
5. Never map a time/TAT column to a count concept

Sheets to analyze:
${JSON.stringify(testSheets, null, 2)}

Return ONLY this JSON structure, no markdown:
{
  "SheetName": {
    "sheetType": "date_summary",
    "isCountableSheet": true,
    "columns": {
      "Requests": "total_requests",
      "Completed": "completed_count"
    }
  }
}
`

async function test() {
  try {
    const result = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    const text = result.choices[0].message.content || '';
    console.log('RAW AZURE RESPONSE:')
    console.log(text)
    console.log('\nPARSED RESULT:')
    const cleaned = text.replace(/\`\`\`json|\`\`\`/g, '').trim()
    console.log(JSON.parse(cleaned))
  } catch (err) {
    console.error('AZURE OPENAI ERROR:', err)
  }
}

test()
