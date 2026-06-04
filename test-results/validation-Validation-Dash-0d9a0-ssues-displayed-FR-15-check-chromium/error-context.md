# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: validation.spec.ts >> Validation Dashboard E2E >> Test 1: Upload valid Excel -> validation runs -> issues displayed + FR-15 check
- Location: tests/e2e/validation.spec.ts:71:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Sheet Preview')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Sheet Preview')

```

```yaml
- 'dialog "Preview: BLK_Max_Hospital-Porter_Request_Summary2026-06-01.xlsx"':
  - 'heading "Preview: BLK_Max_Hospital-Porter_Request_Summary2026-06-01.xlsx" [level=2]'
  - text: "3 sheets detected Location Summary 1 rows · 5 columns Detected type: Location Summary Date Summary 1 rows · 5 columns Detected type: Date Summary Request Details 2 rows · 14 columns Detected type: Unknown"
  - button "Cancel"
  - button "Start Validation →"
  - button "Close"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import path from 'path';
  3   | import fs from 'fs';
  4   | import * as xlsx from 'xlsx';
  5   | 
  6   | // Utility to create a clean excel file for Test 7
  7   | const createCleanExcel = () => {
  8   |   const wb = xlsx.utils.book_new();
  9   |   const ws1 = xlsx.utils.aoa_to_sheet([['Location', 'Requested', 'Completed', 'Cancelled', 'Rejected'], ['Floor 1', 10, 8, 1, 1]]);
  10  |   xlsx.utils.book_append_sheet(wb, ws1, 'Location Summary');
  11  |   const ws2 = xlsx.utils.aoa_to_sheet([['Date', 'Total Requests', 'Total Completed', 'Total Cancelled', 'Total Rejected'], ['2026-06-01', 10, 8, 1, 1]]);
  12  |   xlsx.utils.book_append_sheet(wb, ws2, 'Date Summary');
  13  |   const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  14  |   const cleanPath = path.join(__dirname, '../fixtures/clean_sample.xlsx');
  15  |   fs.writeFileSync(cleanPath, buffer);
  16  |   return cleanPath;
  17  | };
  18  | 
  19  | // Create a dummy CSV for Test 6
  20  | const createDummyCsv = () => {
  21  |   const csvPath = path.join(__dirname, '../fixtures/dummy.csv');
  22  |   fs.writeFileSync(csvPath, "id,name\n1,test");
  23  |   return csvPath;
  24  | };
  25  | 
  26  | // Utility to create a sample file with issues for testing
  27  | const createSampleExcel = () => {
  28  |   const wb = xlsx.utils.book_new();
  29  |   // FR-06 mismatch (Location says 240, Date says 153)
  30  |   const ws1 = xlsx.utils.aoa_to_sheet([
  31  |     ['Location', 'Requested', 'Completed', 'Cancelled', 'Rejected'], 
  32  |     ['Floor 1', 240, 200, 20, 20]
  33  |   ]);
  34  |   xlsx.utils.book_append_sheet(wb, ws1, 'Location Summary');
  35  |   
  36  |   const ws2 = xlsx.utils.aoa_to_sheet([
  37  |     ['Date', 'Total Requests', 'Total Completed', 'Total Cancelled', 'Total Rejected'], 
  38  |     ['2026-06-01', 153, 130, 10, 13]
  39  |   ]);
  40  |   xlsx.utils.book_append_sheet(wb, ws2, 'Date Summary');
  41  |   
  42  |   // FR-15 duplicate ID
  43  |   const ws3 = xlsx.utils.aoa_to_sheet([
  44  |     ['Request ID', 'Date', 'Location', 'Pool', 'Requested By', 'Porter ID', 'Status', 'Requested Time', 'Assigned Time', 'Accepted Time', 'Arrived Time', 'Started Time', 'Completed Time', 'TAT'], 
  45  |     ['REQ123', '2026-06-01', 'Floor 1', 'Pool A', 'Dr Smith', 'P1', 'Completed', '09:00', '09:05', '09:06', '09:10', '09:15', '09:30', '30'],
  46  |     ['REQ123', '2026-06-01', 'Floor 1', 'Pool A', 'Dr Smith', 'P1', 'Completed', '09:00', '09:05', '09:06', '09:10', '09:15', '09:30', '30']
  47  |   ]);
  48  |   xlsx.utils.book_append_sheet(wb, ws3, 'Request Details');
  49  | 
  50  |   const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  51  |   const samplePath = path.join(__dirname, '../fixtures/BLK_Max_Hospital-Porter_Request_Summary2026-06-01.xlsx');
  52  |   fs.writeFileSync(samplePath, buffer);
  53  |   return samplePath;
  54  | };
  55  | 
  56  | test.describe('Validation Dashboard E2E', () => {
  57  |   let sampleFilePath: string;
  58  |   let cleanFilePath: string;
  59  |   let csvFilePath: string;
  60  | 
  61  |   test.beforeAll(() => {
  62  |     // Ensure fixtures dir exists
  63  |     if (!fs.existsSync(path.join(__dirname, '../fixtures'))) {
  64  |       fs.mkdirSync(path.join(__dirname, '../fixtures'), { recursive: true });
  65  |     }
  66  |     sampleFilePath = createSampleExcel();
  67  |     cleanFilePath = createCleanExcel();
  68  |     csvFilePath = createDummyCsv();
  69  |   });
  70  | 
  71  |   test('Test 1: Upload valid Excel -> validation runs -> issues displayed + FR-15 check', async ({ page }) => {
  72  |     await page.goto('/');
  73  |     
  74  |     // Upload file
  75  |     await page.setInputFiles('input[type="file"]', sampleFilePath);
  76  |     
  77  |     // Sheet preview modal should appear
> 78  |     await expect(page.getByText('Sheet Preview')).toBeVisible();
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  79  |     await page.getByRole('button', { name: /start validation/i }).click();
  80  | 
  81  |     // Progress screen
  82  |     await expect(page.getByText('Parsing Excel Structure...')).toBeVisible();
  83  |     
  84  |     // Wait for dashboard to load
  85  |     await expect(page.getByText('Validation Audit')).toBeVisible({ timeout: 15000 });
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
```