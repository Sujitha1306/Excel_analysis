"use client";

import React, { createContext, useContext, useRef, useState, ReactNode } from "react";
import { ValidationReport, ParsedWorkbook } from "@/lib/validator/types";
import { EnrichedIssue } from "@/lib/ai/enrichment";

interface ValidationContextType {
  setParsedWorkbook: (workbook: ParsedWorkbook | null) => void;
  setValidationReport: (report: ValidationReport | null, enriched?: Record<string, EnrichedIssue>) => void;
  getParsedWorkbook: () => ParsedWorkbook | null;
  getValidationReport: () => { report: ValidationReport | null, enriched: Record<string, EnrichedIssue> };
  resetValidation: () => void;
  isReady: boolean;
}

const ValidationContext = createContext<ValidationContextType | null>(null);

export function ValidationProvider({ children }: { children: ReactNode }) {
  // Use ref for large data — survives route changes, no size limit, no serialization needed
  const parsedWorkbookRef = useRef<ParsedWorkbook | null>(null);
  const validationReportRef = useRef<ValidationReport | null>(null);
  const enrichedIssuesRef = useRef<Record<string, EnrichedIssue>>({});
  
  // Use state only for triggering re-renders when needed (like indicating we have results)
  const [isReady, setIsReady] = useState(false);

  const setParsedWorkbook = (workbook: ParsedWorkbook | null) => {
    parsedWorkbookRef.current = workbook;
  };

  const setValidationReport = (report: ValidationReport | null, enriched: Record<string, EnrichedIssue> = {}) => {
    validationReportRef.current = report;
    enrichedIssuesRef.current = enriched;
    setIsReady(true);
  };

  const getParsedWorkbook = () => parsedWorkbookRef.current;

  const getValidationReport = () => ({
    report: validationReportRef.current,
    enriched: enrichedIssuesRef.current
  });

  const resetValidation = () => {
    parsedWorkbookRef.current = null;
    validationReportRef.current = null;
    enrichedIssuesRef.current = {};
    setIsReady(false);
  };

  return (
    <ValidationContext.Provider value={{
      setParsedWorkbook,
      setValidationReport,
      getParsedWorkbook,
      getValidationReport,
      resetValidation,
      isReady
    }}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation() {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error("useValidation must be used within a ValidationProvider");
  }
  return context;
}
