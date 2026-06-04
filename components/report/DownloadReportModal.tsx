"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Download, FileCheck2 } from "lucide-react";
import { ValidationReport } from "@/lib/validator/types";
import { Button } from "@/components/ui/button";

interface DownloadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ValidationReport;
}

export function DownloadReportModal({ isOpen, onClose, report }: DownloadReportModalProps) {
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [isDownloading, setIsDownloading] = useState(false);

  // Sections toggle
  const [sections, setSections] = useState({
    executiveSummary: true,
    perSheetDetails: true,
    crossSheetComparison: true,
    remediation: true,
  });

  const handleToggle = (key: keyof typeof sections) => {
    setSections(s => ({ ...s, [key]: !s[key] }));
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, format, sections }),
      });

      if (!res.ok) throw new Error("Failed to generate report");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ExcelAudit_Report_${report.fileName.replace(/\.[^/.]+$/, "")}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to download the report.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600" />
              Download Validation Report
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Report Summary */}
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200">
              <p className="text-sm font-semibold text-slate-900 mb-1 break-words">File: {report.fileName}</p>
              <p className="text-xs text-slate-500 mb-3">Validated: {new Date(report.validatedAt).toLocaleString()}</p>
              
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="font-medium text-slate-700">Quality Score: <span className="font-bold text-indigo-700">{Math.round(report.qualityScore)}/100</span></span>
                <span className="text-slate-300">|</span>
                <span className="font-medium text-red-700">{report.criticalCount} Critical</span>
                <span className="font-medium text-amber-700">{report.mediumCount} Medium</span>
                <span className="font-medium text-blue-700">{report.lowCount} Low</span>
              </div>
            </div>

            {/* Format Selection */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Format</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setFormat("pdf")}
                  className={`flex-1 p-3 border transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                    format === "pdf" ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4" /> PDF Report (Recommended)
                </button>
                <button
                  onClick={() => setFormat("docx")}
                  className={`flex-1 p-3 border transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                    format === "docx" ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" /> Word Document (.docx)
                </button>
              </div>
            </div>

            {/* Sections Selection */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Include Sections</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={sections.executiveSummary} onChange={() => handleToggle('executiveSummary')} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Executive Summary (AI Generated)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={sections.perSheetDetails} onChange={() => handleToggle('perSheetDetails')} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Per-sheet Issue Details</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={sections.crossSheetComparison} onChange={() => handleToggle('crossSheetComparison')} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Cross-sheet Comparison Tables</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={sections.remediation} onChange={() => handleToggle('remediation')} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Suggested Remediation Steps</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose} disabled={isDownloading}>
                Cancel
              </Button>
              <Button 
                onClick={handleDownload} 
                disabled={isDownloading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
              >
                {isDownloading ? 'Generating...' : `Download ${format.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
