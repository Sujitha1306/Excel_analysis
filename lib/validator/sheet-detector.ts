export type SheetType = 
  | 'Location Summary'
  | 'Date Summary'
  | 'Pool Summary'
  | 'Request Details'
  | 'Porter Performance'
  | 'Idle Summary'
  | 'Unknown';

interface SheetSignature {
  type: SheetType;
  requiredHeaders: string[]; // These are normalized (lowercase, trimmed)
  minMatchRatio: number; // Ratio of required headers that must be found
}

const SIGNATURES: SheetSignature[] = [
  {
    type: 'Request Details',
    requiredHeaders: [
      'requestid', 'porter name', 'status', 'start time', 'end time', 
      'tat (accept to arrive)', 'tat (arrive to complete)', 'tat (assigned to complete)',
      'completed by'
    ],
    minMatchRatio: 0.6,
  },
  {
    type: 'Location Summary',
    requiredHeaders: ['location', 'requested', 'completed', 'rejected', 'cancelled', 'type'],
    minMatchRatio: 0.8,
  },
  {
    type: 'Date Summary',
    requiredHeaders: ['date', 'total requests', 'completed', 'cancelled', 'tat (create to complete)'],
    minMatchRatio: 0.8,
  },
  {
    type: 'Pool Summary',
    requiredHeaders: ['pool name', 'total requests', 'completed', 'cancelled', 'open', 'rejected'],
    minMatchRatio: 0.8,
  },
  {
    type: 'Porter Performance',
    requiredHeaders: ['porter id', 'porter name', 'completed', 'total intime', 'total time (accept to complete)'],
    minMatchRatio: 0.8,
  },
  {
    type: 'Idle Summary',
    requiredHeaders: ['porter id', 'porter name', 'total idle time'],
    minMatchRatio: 1.0, // All 3 must exist for Idle Summary to be confident
  }
];

/**
 * Normalizes a header string by trimming and lowercasing it.
 */
function normalizeHeader(header: unknown): string {
  if (typeof header !== 'string') return '';
  return header.trim().toLowerCase();
}

/**
 * Detects the type of sheet based on the column headers.
 * Extracts the first row (or first few rows) to find headers.
 * @param headers An array of column header strings from the sheet
 * @returns The inferred SheetType
 */
export function detectSheetType(headers: unknown[]): SheetType {
  const normalizedHeaders = headers.map(normalizeHeader).filter(h => h.length > 0);
  
  if (normalizedHeaders.length === 0) return 'Unknown';

  let bestMatch: SheetType = 'Unknown';
  let highestScore = 0;

  for (const sig of SIGNATURES) {
    let matchCount = 0;
    
    // Check how many of the required headers are present in the provided headers
    for (const req of sig.requiredHeaders) {
      if (normalizedHeaders.some(h => h.includes(req) || req.includes(h))) {
        matchCount++;
      }
    }

    const matchRatio = matchCount / sig.requiredHeaders.length;
    
    if (matchRatio >= sig.minMatchRatio && matchRatio > highestScore) {
      highestScore = matchRatio;
      bestMatch = sig.type;
    }
  }

  return bestMatch;
}
