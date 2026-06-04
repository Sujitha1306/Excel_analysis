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

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Core Metadata */}
        <div className="mb-6">
          <div className="text-sm font-semibold text-slate-700 mb-1">Sheet: <span className="font-normal">{issue.sheetName}</span></div>
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Validation Condition</h4>
            <div className="bg-slate-100 border border-slate-200 p-2.5 rounded text-sm font-mono text-slate-800">
              {issue.condition}
            </div>
          </div>
        </div>

        {/* AI Enrichment Block */}
        <div className="mb-8 bg-indigo-50 border border-indigo-100 p-5 relative overflow-hidden rounded-md shadow-sm">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <span className="text-lg">🤖</span> AI Description
            </h4>
            {enrichedData && (
              <span className={`text-xs font-bold px-2 py-1 uppercase tracking-wide rounded ${confidenceColor}`}>
                {enrichedData.confidence} Confidence
              </span>
            )}
          </div>
          <p className="text-indigo-950 text-sm leading-relaxed mb-0">
            {enrichedData?.aiDescription || issue.description}
          </p>
        </div>

        {/* Affected Rows / Cross-Sheet Comparison */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            {issue.sheetName.includes('↔') ? 'Cross-Sheet Comparison' : `Affected Rows (${issue.totalAffectedRows})`}
          </h4>
          <div className="bg-white border border-slate-200 overflow-hidden rounded-md shadow-sm">
            {issue.sheetName.includes('↔') && issue.affectedRows.length === 2 ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 font-semibold w-1/2 border-r border-slate-200">
                      {issue.sheetName.split('↔')[0].trim()}
                    </th>
                    <th className="px-4 py-2 font-semibold w-1/2">
                      {issue.sheetName.split('↔')[1].trim()}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border-r border-slate-200 align-top">
                      <div className="text-xs text-slate-500 mb-1">{issue.affectedRows[0].columnName.split('—')[0]?.trim() || issue.affectedRows[0].columnName}</div>
                      <div className="font-mono text-lg font-bold text-slate-800">{renderValue(issue.affectedRows[0].actualValue)}</div>
                      <div className="mt-2 text-red-600 text-xl">🔴</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-xs text-slate-500 mb-1">{issue.affectedRows[1].columnName.split('—')[0]?.trim() || issue.affectedRows[1].columnName}</div>
                      <div className="font-mono text-lg font-bold text-slate-800">{renderValue(issue.affectedRows[1].actualValue)}</div>
                      <div className="mt-2 text-green-600 text-xl">🟢</div>
                    </td>
                  </tr>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={2} className="px-4 py-2 text-sm text-slate-700">
                      <span className="font-semibold">Discrepancy:</span> {issue.description.split('. ').pop() || 'Values do not match.'}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <>
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 font-semibold w-16 text-center">Row</th>
                      <th className="px-4 py-2 font-semibold">Column</th>
                      <th className="px-4 py-2 font-semibold">Sample Value</th>
                      <th className="px-4 py-2 font-semibold">Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-500 border-r border-slate-100 text-center">
                          {row.rowNumber}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                          {row.columnName}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-red-700 border-r border-slate-100">
                          {renderValue(row.actualValue)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-green-700">
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
              </>
            )}
          </div>
        </div>

        {/* Affected Columns */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Affected Columns</h4>
          <div className="flex flex-wrap gap-2">
            {issue.affectedColumns.map(col => (
              <span key={col} className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded shadow-sm">
                [{col}]
              </span>
            ))}
          </div>
        </div>

        {/* Remediation */}
        <div className="bg-white p-5 border border-slate-200 rounded-md shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            Remediation
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">
              {issue.remediationType.toUpperCase()}
            </span>
          </h4>
          <p className="text-slate-800 text-sm leading-relaxed">
            {enrichedData?.aiRemediation || issue.remediationSuggestion}
          </p>
        </div>

      </div>
    </motion.div>
  );
}
