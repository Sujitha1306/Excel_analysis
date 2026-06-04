"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ValidationIssue } from "@/lib/validator/types";
import { EnrichedIssue } from "@/lib/ai/enrichment";
import { IssueCard } from "./IssueCard";

interface IssueFeedProps {
  issues: ValidationIssue[];
  enrichedIssues: Record<string, EnrichedIssue>;
  selectedIssueId: string | null;
  onSelectIssue: (issueId: string) => void;
  acknowledgedIssues: Set<string>;
  onToggleAcknowledge: (issueId: string) => void;
}

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function IssueFeed({
  issues,
  enrichedIssues,
  selectedIssueId,
  onSelectIssue,
  acknowledgedIssues,
  onToggleAcknowledge
}: IssueFeedProps) {
  const [collapsedSheets, setCollapsedSheets] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleSheet = (sheet: string) => {
    const next = new Set(collapsedSheets);
    if (next.has(sheet)) next.delete(sheet);
    else next.add(sheet);
    setCollapsedSheets(next);
  };

  const grouped = issues.reduce((acc, issue) => {
    if (!acc[issue.sheetName]) acc[issue.sheetName] = [];
    acc[issue.sheetName].push(issue);
    return acc;
  }, {} as Record<string, ValidationIssue[]>);

  // Flatten items for virtualization if needed
  type RowType = { type: 'header', sheet: string, count: number } | { type: 'issue', issue: ValidationIssue };
  const rows: RowType[] = [];
  
  Object.entries(grouped).forEach(([sheet, sheetIssues]) => {
    rows.push({ type: 'header', sheet, count: sheetIssues.length });
    if (!collapsedSheets.has(sheet)) {
      sheetIssues.forEach(issue => rows.push({ type: 'issue', issue }));
    }
  });

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index]?.type === 'header' ? 40 : 120, // rough height estimates
    overscan: 5,
  });

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-lg">No issues found matching the criteria.</p>
      </div>
    );
  }

  const useVirtual = issues.length > 100;

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto pr-4 custom-scrollbar h-full relative">
      {useVirtual ? (
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === 'header' ? (
                  <button
                    onClick={() => toggleSheet(row.sheet)}
                    className="flex items-center gap-2 w-full text-left mb-3 group"
                  >
                    <span className="text-slate-400 group-hover:text-slate-700 transition-colors">
                      {collapsedSheets.has(row.sheet) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{row.sheet}</h3>
                    <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1">
                      {row.count}
                    </span>
                  </button>
                ) : (
                  <div className="pb-3">
                    <IssueCard
                      issue={row.issue}
                      enrichedData={enrichedIssues[row.issue.id]}
                      isSelected={selectedIssueId === row.issue.id}
                      isAcknowledged={acknowledgedIssues.has(row.issue.id)}
                      onSelect={() => onSelectIssue(row.issue.id)}
                      onToggleAcknowledge={(e) => {
                        e.stopPropagation();
                        onToggleAcknowledge(row.issue.id);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col">
          {Object.entries(grouped).map(([sheet, sheetIssues]) => {
            const isCollapsed = collapsedSheets.has(sheet);
            return (
              <div key={sheet} className="mb-6">
                <button
                  onClick={() => toggleSheet(sheet)}
                  className="flex items-center gap-2 w-full text-left mb-3 group"
                >
                  <span className="text-slate-400 group-hover:text-slate-700 transition-colors">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{sheet}</h3>
                  <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1">
                    {sheetIssues.length}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col">
                        {sheetIssues.map(issue => (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            enrichedData={enrichedIssues[issue.id]}
                            isSelected={selectedIssueId === issue.id}
                            isAcknowledged={acknowledgedIssues.has(issue.id)}
                            onSelect={() => onSelectIssue(issue.id)}
                            onToggleAcknowledge={(e) => {
                              e.stopPropagation();
                              onToggleAcknowledge(issue.id);
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
