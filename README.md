# ExcelAudit - Hospital Porter Management Data Validation

ExcelAudit is an AI-powered Next.js application that parses, validates, and analyzes hospital operational Excel data. It flags inconsistencies across sheets, applies statistical checks, and uses AI (Google Gemini / Anthropic Claude) to generate human-readable remediation reports.

## Live Deployment

Production URL: [https://excel-audit-tracker.vercel.app](https://excel-audit-tracker.vercel.app)

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   Create a `.env.local` file in the root directory and add your Gemini API key:
   ```
   GEMINI_API_KEY="your_google_gemini_api_key_here"
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) to upload your hospital data.

## Switching to Anthropic Claude

The project currently uses `gemini-1.5-flash` for fast, cost-effective AI enrichment. To switch to Claude:
1. Change `lib/ai/enrichment.ts` to import `@anthropic-ai/sdk`.
2. Update the system prompt configuration in `app/api/ai-validate/route.ts` and `app/api/generate-report/route.ts`.
3. Set `ANTHROPIC_API_KEY` in your `.env.local`.

## E2E Testing

Playwright tests cover the full upload and validation flow:
```bash
npx playwright test
```

## Security & Performance

- **In-memory Processing**: Uploaded files are parsed entirely in memory using `xlsx` and are never saved to disk.
- **Rate Limiting**: AI API routes include basic in-memory rate limiting.
- **Zod Validation**: Strict schema validation protects the API endpoints.
- **Content Security Policy (CSP)**: Headers enforced in `next.config.mjs`.
# Excel_analysis
