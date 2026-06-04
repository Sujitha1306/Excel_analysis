"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface FilterBarProps {
  sheets: string[];
  activeSheet: string | null;
  onSelectSheet: (sheet: string | null) => void;
  activeSeverity: string | null;
  onSelectSeverity: (sev: string | null) => void;
  issueCountsBySheet: Record<string, number>;
}

const SHEET_COLORS: Record<string, string> = {
  'Location Summary': 'bg-indigo-500',
  'Date Summary': 'bg-blue-500',
  'Pool Summary': 'bg-cyan-500',
  'Request Details': 'bg-orange-500',
  'Porter Performance': 'bg-green-500',
  'Idle Summary': 'bg-slate-500',
};

export function FilterBar({ 
  sheets, activeSheet, onSelectSheet, activeSeverity, onSelectSeverity, issueCountsBySheet 
}: FilterBarProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex flex-col gap-4 mb-6 pb-4 border-b border-slate-200"
    >
      {/* Sheet Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-500 mr-2 uppercase tracking-wide">Sheet:</span>
        <button
          onClick={() => onSelectSheet(null)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors border ${
            activeSheet === null 
              ? 'bg-slate-900 text-white border-slate-900' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Sheets
        </button>
        {sheets.map(sheet => {
          const colorClass = SHEET_COLORS[sheet] || 'bg-slate-500';
          const count = issueCountsBySheet[sheet] || 0;
          const isActive = activeSheet === sheet;
          
          return (
            <button
              key={sheet}
              onClick={() => onSelectSheet(sheet)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors border ${
                isActive 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
              {sheet}
              {count > 0 && (
                <Badge variant={isActive ? "secondary" : "outline"} className={`ml-1 px-1.5 py-0 min-w-5 justify-center ${isActive ? 'bg-slate-700 text-white border-transparent' : ''}`}>
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Severity Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-500 mr-2 uppercase tracking-wide">Severity:</span>
        <button
          onClick={() => onSelectSeverity(null)}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            activeSeverity === null ? 'text-slate-900 underline underline-offset-4' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onSelectSeverity('critical')}
          className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeSeverity === 'critical' ? 'text-red-700 underline underline-offset-4' : 'text-slate-500 hover:text-red-700'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Critical
        </button>
        <button
          onClick={() => onSelectSeverity('medium')}
          className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeSeverity === 'medium' ? 'text-amber-700 underline underline-offset-4' : 'text-slate-500 hover:text-amber-700'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          Medium
        </button>
        <button
          onClick={() => onSelectSeverity('low')}
          className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeSeverity === 'low' ? 'text-blue-700 underline underline-offset-4' : 'text-slate-500 hover:text-blue-700'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          Low
        </button>
      </div>
    </motion.div>
  );
}
