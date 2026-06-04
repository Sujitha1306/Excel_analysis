import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { ValidationIssue } from "@/lib/validator/types";
import { EnrichedIssue } from "@/lib/ai/enrichment";
import { Button } from "@/components/ui/button";

interface IssueDetailPanelProps {
  issue: ValidationIssue;
  enrichedData?: EnrichedIssue;
  onClose: () => void;
}

export function IssueDetailPanel({ issue, enrichedData, onClose }: IssueDetailPanelProps) {
  const [showAllRows, setShowAllRows] = useState(false);

  const confidenceColor = 
    enrichedData?.confidence === 'high' ? 'text-green-700 bg-green-100' :
    enrichedData?.confidence === 'medium' ? 'text-amber-700 bg-amber-100' :
    'text-slate-700 bg-slate-100';

  const renderValue = (val: unknown) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400 italic">{'<empty>'}</span>;
    }
    const strVal = String(val);
    if (strVal.trim() === '') {
      return <span className="bg-amber-100 text-amber-800 font-mono px-1 rounded">{JSON.stringify(strVal)}</span>; // highlights whitespace
    }
    return strVal;
  };

  const displayedRows = showAllRows ? issue.affectedRows : issue.affectedRows.slice(0, 10);
  const hiddenRowsCount = issue.affectedRows.length - displayedRows.length;

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-xl"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">{issue.issueType}</h2>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${issue.severity === 'critical' ? 'bg-red-100 text-red-700' : issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {issue.severity}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-900">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        <div className="space-y-4 bg-white p-4 border border-slate-200 rounded-md shadow-sm text-sm">
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-700 min-w-[150px]">Page:</span>
            <span className="text-slate-900">{issue.sheetName}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-700 min-w-[150px]">Validation rule:</span>
            <span className="text-slate-900 font-mono text-xs bg-slate-100 px-1 rounded">{issue.condition}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-700 min-w-[150px]">Why this is an error:</span>
            <span className="text-slate-900 leading-relaxed">{enrichedData?.aiDescription || issue.description}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-700 min-w-[150px]">How to fix:</span>
            <span className="text-slate-900 leading-relaxed">{enrichedData?.aiRemediation || issue.remediationSuggestion}</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Affected Rows ({issue.totalAffectedRows})
          </h4>
          <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 font-semibold text-center">Row</th>
                  <th className="px-4 py-2 font-semibold">Column</th>
                  <th className="px-4 py-2 font-semibold">Found</th>
                  <th className="px-4 py-2 font-semibold">Expected</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-500 border-r border-slate-100 text-center">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-2 text-slate-700 border-r border-slate-100">
                      {row.columnName}
                    </td>
                    <td className="px-4 py-2 font-mono text-red-700 border-r border-slate-100 max-w-[200px] truncate">
                      {renderValue(row.actualValue)}
                    </td>
                    <td className="px-4 py-2 font-mono text-green-700 max-w-[200px] truncate">
                      {renderValue(row.expectedValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hiddenRowsCount > 0 && (
              <div className="p-2 bg-slate-50 border-t border-slate-200 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAllRows(true)} className="text-xs text-slate-600 hover:text-slate-900">
                  Show all {hiddenRowsCount} remaining rows ▼
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
