"use client";

import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { ValidationIssue } from "@/lib/validator/types";
import { EnrichedIssue } from "@/lib/ai/enrichment";

interface IssueCardProps {
  issue: ValidationIssue;
  enrichedData?: EnrichedIssue;
  isSelected: boolean;
  isAcknowledged: boolean;
  onSelect: () => void;
  onToggleAcknowledge: (e: React.MouseEvent) => void;
}

export function IssueCard({ 
  issue, 
  enrichedData, 
  isSelected, 
  isAcknowledged, 
  onSelect, 
  onToggleAcknowledge 
}: IssueCardProps) {
  
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50 hover:bg-red-100',
          border: 'border-red-400',
          text: 'text-red-900',
          icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
          accent: 'bg-red-600'
        };
      case 'medium':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100',
          border: 'border-amber-400',
          text: 'text-amber-900',
          icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
          accent: 'bg-amber-500'
        };
      default:
        return {
          bg: 'bg-blue-50 hover:bg-blue-100',
          border: 'border-blue-400',
          text: 'text-blue-900',
          icon: <Info className="w-5 h-5 text-blue-600" />,
          accent: 'bg-blue-500'
        };
    }
  };

  const s = getSeverityStyles(issue.severity);
  
  // Use enriched description if available, fallback to rule description
  const displayDescription = enrichedData?.aiDescription || issue.description;
  const isAiEnriched = !!enrichedData?.aiDescription;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: isAcknowledged ? 0.6 : 1, 
        y: 0,
        scale: isSelected ? 1.02 : 1
      }}
      transition={{ duration: 0.2 }}
      onClick={onSelect}
      className={`
        relative cursor-pointer mb-3 overflow-hidden
        border transition-all duration-200
        ${isSelected ? 'shadow-md border-l-4' : 'shadow-sm hover:shadow'}
        ${isSelected ? s.border : 'border-slate-200'}
        ${s.bg}
      `}
    >
      {/* Selection indicator line */}
      {isSelected && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.accent}`} />
      )}

      <div className={`p-4 ${isSelected ? 'pl-5' : ''}`}>
        <div className="flex justify-between items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {s.icon}
          </div>
          
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-sm font-bold uppercase tracking-wider ${s.text}`}>
                {issue.issueType}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {issue.sheetName}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} border ${s.border}`}>
                {issue.severity.toUpperCase()}
              </span>
            </div>
            
            <div className="mb-2">
              <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                {issue.condition}
              </code>
            </div>

            <div className="flex flex-wrap gap-1.5 my-2">
              {issue.affectedColumns.map(col => (
                <span key={col} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                  {col}
                </span>
              ))}
            </div>

            <div className="mt-3 text-xs font-medium text-slate-500">
              {issue.totalAffectedRows} rows affected
            </div>
          </div>

          <button 
            onClick={onToggleAcknowledge}
            className={`
              shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors
              ${isAcknowledged 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-white border border-slate-300 text-slate-300 hover:text-slate-500 hover:border-slate-400'
              }
            `}
            title={isAcknowledged ? "Unacknowledge" : "Acknowledge Issue"}
          >
            <CheckCircle2 className={`w-5 h-5 ${isAcknowledged ? 'fill-green-100' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
