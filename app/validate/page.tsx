"use client";

import { useState, useEffect, useRef } from "react";
import { ValidationReport } from "@/lib/validator/types";
import { EnrichedIssue } from "@/lib/ai/enrichment";
import { SummaryBar } from "@/components/dashboard/SummaryBar";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { IssueFeed } from "@/components/dashboard/IssueFeed";
import { IssueDetailPanel } from "@/components/dashboard/IssueDetailPanel";
import { ValidationProgress } from "@/components/dashboard/ValidationProgress";
import { AnimatePresence, motion } from "framer-motion";
import { useValidation } from "@/components/ValidationProvider";
import { useRouter } from "next/navigation";
import { DownloadReportModal } from "@/components/report/DownloadReportModal";
import { Button } from "@/components/ui/button";

export default function ValidatePage() {
  const router = useRouter();
  const { getParsedWorkbook, setValidationReport, getValidationReport, resetValidation, isReady } = useValidation();
  
  const { report, enriched: enrichedMap } = getValidationReport();
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing...");
  
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [activeSeverity, setActiveSeverity] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [acknowledgedIssues, setAcknowledgedIssues] = useState<Set<string>>(new Set());
  
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      runPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPipeline = async () => {
    if (typeof window === 'undefined') return;
    
    const workbook = getParsedWorkbook();
    if (!workbook) {
      router.push('/');
      return;
    }
    
    console.log('1. parsedWorkbook loaded:', !!workbook);

    setIsProcessing(true);
    setProgress(10);
    setCurrentStep("Mapping Columns with AI...");

    const mappingPayload = {
      ...workbook,
      sheets: workbook.sheets.map(sheet => ({
        ...sheet,
        data: sheet.data.slice(0, 3)
      }))
    };

    let workbookMapping = {};
    try {
      const mapRes = await fetch('/api/map-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingPayload)
      });

      if (mapRes.ok) {
        workbookMapping = await mapRes.json();
      }
    } catch (err) {
      console.error('Failed to map columns', err);
    }

    setProgress(30);
    setCurrentStep("Running Core Validation Rules...");

    // Dynamically import to avoid running heavy logic on mount
    const { runValidationPipeline } = await import('@/lib/validator');
    
    const generatedReport = runValidationPipeline(workbook, workbookMapping);
    console.log('2. pipeline complete, issues:', generatedReport.issues.length);

    setProgress(65);
    setCurrentStep("AI Enrichment via Gemini...");

    let finalReport = generatedReport;
    const finalEnrichedMap: Record<string, EnrichedIssue> = {};

    try {
      const res = await fetch('/api/ai-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedReport)
      });
      
      if (res.ok) {
        const enrichedReport = await res.json();
        console.log('3. AI enrichment complete:', !!enrichedReport);
        
        // Ensure aiAvailable is set
        finalReport = enrichedReport ?? generatedReport;
        
        if (enrichedReport?.enrichedIssues) {
          enrichedReport.enrichedIssues.forEach((e: EnrichedIssue) => finalEnrichedMap[e.id] = e);
        }
      } else {
        console.log('3. AI enrichment failed, using original report');
        finalReport.aiAvailable = false;
      }
    } catch (e) {
      console.error('Failed to fetch AI enrichment', e);
      console.log('3. AI enrichment failed, using original report');
      finalReport.aiAvailable = false;
    }

    setProgress(100);
    setCurrentStep("Finalizing Dashboard...");
    await new Promise(r => setTimeout(r, 500));

    console.log('4. rendering dashboard with:', finalReport.issues.length);
    setValidationReport(finalReport, finalEnrichedMap);
    setIsProcessing(false);
  };

  const handleToggleAcknowledge = (id: string) => {
    const next = new Set(acknowledgedIssues);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAcknowledgedIssues(next);
  };

  if (isProcessing || !report) {
    return (
      <main className="min-h-screen bg-white">
        <ValidationProgress progress={progress} currentStep={currentStep} />
      </main>
    );
  }

  // Filter logic
  let filteredIssues = report.issues;
  if (activeSheet && activeSheet !== "all") {
    filteredIssues = filteredIssues.filter(i => i.sheetName === activeSheet);
  }
  if (activeSeverity && activeSeverity !== "all") {
    filteredIssues = filteredIssues.filter(i => i.severity === activeSeverity);
  }

  // Counts for filter tabs
  const issueCountsBySheet = report.issues.reduce((acc, issue) => {
    const sheet = issue.sheetName || 'Cross-Sheet / General';
    acc[sheet] = (acc[sheet] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const selectedIssue = report.issues.find(i => i.id === selectedIssueId);
  const selectedEnrichment = selectedIssueId ? enrichedMap[selectedIssueId] : undefined;

  const handleNewUpload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('parsedWorkbook');
      sessionStorage.removeItem('validationReport');
    }
    router.push('/');
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden text-slate-900">
      
      {/* Main Feed Panel (Left) */}
      <div className={`flex flex-col h-full transition-all duration-300 md:flex md:flex-col
        ${selectedIssueId ? 'w-full md:w-2/5 absolute md:relative z-10' : 'w-full max-w-5xl mx-auto z-10'} 
        p-4 md:p-6 bg-white`}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Validation Audit</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">{report.fileName}</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleNewUpload}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              Validate Another File
            </button>
            <Button 
              onClick={() => setIsDownloadModalOpen(true)}
              className="bg-brand hover:bg-brand-hover text-white shadow-sm"
            >
              Download Report
            </Button>
          </div>
        </div>

        {report.totalIssues === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-pass-bg text-pass-text rounded-full flex items-center justify-center mb-4 text-3xl">✓</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Issues Found</h2>
            <p className="text-slate-500">The uploaded data passed all validation rules perfectly.</p>
          </div>
        ) : (
          <>
            <SummaryBar 
              total={report.totalIssues}
              critical={report.criticalCount}
              medium={report.mediumCount}
              low={report.lowCount}
              qualityScore={report.qualityScore}
            />

            <FilterBar 
              sheets={report.sheetsAnalyzed}
              activeSheet={activeSheet}
              onSelectSheet={setActiveSheet}
              activeSeverity={activeSeverity}
              onSelectSeverity={setActiveSeverity}
              issueCountsBySheet={issueCountsBySheet}
            />

            <IssueFeed 
              issues={filteredIssues}
              enrichedIssues={enrichedMap}
              selectedIssueId={selectedIssueId}
              onSelectIssue={(id) => setSelectedIssueId(id === selectedIssueId ? null : id)}
              acknowledgedIssues={acknowledgedIssues}
              onToggleAcknowledge={handleToggleAcknowledge}
            />
          </>
        )}
      </div>

      {/* Detail Panel (Right) - Full screen on mobile */}
      <AnimatePresence>
        {selectedIssueId && selectedIssue && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className={`h-full absolute md:relative top-0 right-0 z-20 overflow-hidden bg-slate-50 border-l border-slate-200 shadow-2xl
              ${selectedIssueId ? 'w-full md:w-[60%]' : 'w-0'}
            `}
          >
            <div className="absolute inset-0">
              <IssueDetailPanel 
                issue={selectedIssue}
                enrichedData={selectedEnrichment}
                onClose={() => setSelectedIssueId(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DownloadReportModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        report={report}
      />
    </div>
  );
}
