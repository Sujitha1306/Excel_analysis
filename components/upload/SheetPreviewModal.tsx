"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParsedWorkbook, ParsedSheet } from "@/lib/validator";
import { CheckCircle2 } from "lucide-react";

interface SheetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  workbook: ParsedWorkbook | null;
  onStartValidation: () => void;
}

export function SheetPreviewModal({
  isOpen,
  onClose,
  workbook,
  onStartValidation,
}: SheetPreviewModalProps) {
  if (!workbook) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Preview: <span className="font-mono text-slate-600 text-lg">{workbook.fileName}</span>
          </DialogTitle>
          <div className="text-sm text-slate-500 mt-1">
            {workbook.sheets.length} sheets detected
          </div>
        </DialogHeader>

        <div className="py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {workbook.sheets.map((sheet: ParsedSheet, idx: number) => (
              <div 
                key={idx} 
                className="flex flex-col p-4 border border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden"
              >
                {/* Left color bar based on detected sheet type (simplified for preview) */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getSheetColorClass(sheet.type)}`} />
                
                <div className="flex justify-between items-start ml-2">
                  <div className="font-semibold text-slate-900">{sheet.sheetName}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    {sheet.rowCount} rows · {sheet.colCount} columns
                  </div>
                </div>
                
                <div className="flex items-center mt-2 ml-2 gap-2">
                  <span className="text-sm text-slate-600">Detected type:</span>
                  <Badge 
                    variant={sheet.type === 'Unknown' ? 'secondary' : 'default'}
                    className={sheet.type !== 'Unknown' ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 border' : ''}
                  >
                    {sheet.type}
                    {sheet.type !== 'Unknown' && <CheckCircle2 className="w-3 h-3 ml-1" />}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            Cancel
          </Button>
          <Button onClick={onStartValidation} className="bg-brand hover:bg-brand-dark text-white">
            Start Validation &rarr;
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getSheetColorClass(type: string): string {
  switch (type) {
    case 'Location Summary': return 'bg-indigo-600';
    case 'Date Summary': return 'bg-blue-600';
    case 'Pool Summary': return 'bg-cyan-600';
    case 'Request Details': return 'bg-orange-600';
    case 'Porter Performance': return 'bg-green-600';
    case 'Idle Summary': return 'bg-slate-600';
    default: return 'bg-slate-300';
  }
}
