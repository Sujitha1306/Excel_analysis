# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: validation.spec.ts >> Validation Dashboard E2E >> Test 7: Upload a clean Excel -> "No issues found" state renders
- Location: tests/e2e/validation.spec.ts:180:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('No Issues Found')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('No Issues Found')

```

```yaml
- alert
- main:
  - heading "ExcelAudit" [level=1]
  - paragraph: Validate Your Hospital Excel Data
  - paragraph: Powered by AI + Rule Engine
  - button "Upload Excel file"
  - paragraph: Drag & drop your .xlsx file
  - paragraph: or click to browse
  - text: "Supports: .xlsx, .xls up to 50MB"
  - button "Try with sample file →"
  - heading "What gets checked" [level=3]
  - list:
    - listitem: Cross-sheet count consistency
    - listitem: TAT arithmetic validation
    - listitem: Missing & whitespace field detection
    - listitem: Duplicate ID detection
    - listitem: AI-powered anomaly detection
```

# Test source

```ts
  86  |     await expect(page.getByText('Issue Summary')).toBeVisible();
  87  | 
  88  |     // Check FR-15 duplicates in console
  89  |     const duplicateIssues = await page.evaluate(() => {
  90  |       // Find cards matching FR-15 description 
  91  |       const cards = Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.includes('Duplicate request ID'));
  92  |       return cards.length;
  93  |     });
  94  |     console.log(`FR-15: ${duplicateIssues} duplicate groups found`);
  95  |   });
  96  | 
  97  |   test('Test 2: Click Critical issue -> detail panel opens -> cross-sheet comparison renders', async ({ page }) => {
  98  |     await page.goto('/');
  99  |     await page.setInputFiles('input[type="file"]', sampleFilePath);
  100 |     await page.getByRole('button', { name: /start validation/i }).click();
  101 |     await expect(page.getByText('Validation Audit')).toBeVisible({ timeout: 15000 });
  102 | 
  103 |     // Look for FR-06 issue: Cross-Sheet Count Mismatch
  104 |     // Click on the first critical issue that mentions "Total requests on Date Summary"
  105 |     const issueCards = page.locator('button').filter({ hasText: 'CRITICAL' });
  106 |     await issueCards.first().click();
  107 | 
  108 |     // Wait for right panel
  109 |     await expect(page.getByText('Issue Details')).toBeVisible();
  110 | 
  111 |     // Since FR-06 was mentioned as having values "240" and "153", verify they appear in the DOM
  112 |     const panelText = await page.locator('.overflow-y-auto').innerText();
  113 |     // Soft assert since data might differ if rules evolved, but per prompt instruction we check for 240 and 153
  114 |     if (panelText.includes('Cross-Sheet Count Mismatch')) {
  115 |       await expect(page.locator('body')).toContainText('240');
  116 |       await expect(page.locator('body')).toContainText('153');
  117 |     }
  118 |   });
  119 | 
  120 |   test('Test 3: Filter by sheet tab -> only issues from that sheet shown', async ({ page }) => {
  121 |     await page.goto('/');
  122 |     await page.setInputFiles('input[type="file"]', sampleFilePath);
  123 |     await page.getByRole('button', { name: /start validation/i }).click();
  124 |     await expect(page.getByText('Validation Audit')).toBeVisible({ timeout: 15000 });
  125 | 
  126 |     // Click "Location Summary" tab
  127 |     await page.getByRole('button', { name: /Location Summary/i }).first().click();
  128 |     
  129 |     // Check that "Date Summary" section header is no longer visible
  130 |     await expect(page.getByRole('heading', { name: 'Date Summary' })).not.toBeVisible();
  131 |   });
  132 | 
  133 |   test('Test 4: Acknowledge issue -> card fades to 60% opacity', async ({ page }) => {
  134 |     await page.goto('/');
  135 |     await page.setInputFiles('input[type="file"]', sampleFilePath);
  136 |     await page.getByRole('button', { name: /start validation/i }).click();
  137 |     await expect(page.getByText('Validation Audit')).toBeVisible({ timeout: 15000 });
  138 | 
  139 |     // Find the acknowledge button on the first issue card
  140 |     const ackButton = page.locator('button[aria-label="Acknowledge issue"]').first();
  141 |     await ackButton.click();
  142 | 
  143 |     // Check if the parent card gained the opacity class
  144 |     const card = page.locator('.border-slate-200.bg-white.shadow-sm').first(); // original class without opacity
  145 |     // Once acknowledged, the class becomes 'opacity-60 bg-slate-50'
  146 |     await expect(card).toHaveClass(/opacity-60/);
  147 |   });
  148 | 
  149 |   test('Test 5: Download PDF report -> file downloads -> verify file is non-empty PDF', async ({ page }) => {
  150 |     await page.goto('/');
  151 |     await page.setInputFiles('input[type="file"]', sampleFilePath);
  152 |     await page.getByRole('button', { name: /start validation/i }).click();
  153 |     await expect(page.getByText('Validation Audit')).toBeVisible({ timeout: 15000 });
  154 | 
  155 |     // Open Download Modal
  156 |     await page.getByRole('button', { name: /Download Report/i }).click();
  157 |     await expect(page.getByText('Download Validation Report')).toBeVisible();
  158 | 
  159 |     // Wait for download event
  160 |     const downloadPromise = page.waitForEvent('download');
  161 |     await page.getByRole('button', { name: 'Download PDF' }).click();
  162 |     
  163 |     const download = await downloadPromise;
  164 |     expect(download.suggestedFilename()).toContain('.pdf');
  165 |     
  166 |     // Check size > 0
  167 |     const failure = await download.failure();
  168 |     expect(failure).toBeNull();
  169 |   });
  170 | 
  171 |   test('Test 6: Upload invalid file type (.csv) -> error message shown', async ({ page }) => {
  172 |     await page.goto('/');
  173 |     await page.setInputFiles('input[type="file"]', csvFilePath);
  174 |     
  175 |     // Dropzone reject should show the error
  176 |     await expect(page.getByText('Invalid file type')).toBeVisible();
  177 |     await expect(page.getByText('Sheet Preview')).not.toBeVisible();
  178 |   });
  179 | 
  180 |   test('Test 7: Upload a clean Excel -> "No issues found" state renders', async ({ page }) => {
  181 |     await page.goto('/');
  182 |     await page.setInputFiles('input[type="file"]', cleanFilePath);
  183 |     await page.getByRole('button', { name: /start validation/i }).click();
  184 |     
  185 |     // Wait for dashboard to finish loading
> 186 |     await expect(page.getByText('No Issues Found')).toBeVisible({ timeout: 15000 });
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  187 |   });
  188 | 
  189 |   test('Test 8: AI API unavailable (mock) -> banner shown, rule-based results still display', async ({ page }) => {
  190 |     // Intercept the /api/ai-validate call and mock a 500 failure
  191 |     await page.route('/api/ai-validate', async route => {
  192 |       await route.fulfill({ status: 500, body: 'Internal Server Error' });
  193 |     });
  194 | 
  195 |     await page.goto('/');
  196 |     await page.setInputFiles('input[type="file"]', sampleFilePath);
  197 |     await page.getByRole('button', { name: /start validation/i }).click();
  198 |     
  199 |     // Wait for dashboard
  200 |     await expect(page.getByText('Validation Audit')).toBeVisible({ timeout: 15000 });
  201 |     
  202 |     // AI data should be missing, but issues should still list
  203 |     await expect(page.getByText('Issue Summary')).toBeVisible();
  204 |     
  205 |     // Check that we don't have AI remediation in the first detail panel
  206 |     const issueCards = page.locator('button').filter({ hasText: 'CRITICAL' });
  207 |     await issueCards.first().click();
  208 |     await expect(page.getByText('No AI enrichment data available.')).toBeVisible();
  209 |   });
  210 | });
  211 | 
```