"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

interface SummaryBarProps {
  total: number;
  critical: number;
  medium: number;
  low: number;
  qualityScore: number;
}

export function SummaryBar({ total, critical, medium, low, qualityScore }: SummaryBarProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="grid grid-cols-5 gap-4 mb-6"
    >
      <Card className="col-span-1 rounded-none border-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Issues</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{total}</p>
        </CardContent>
      </Card>

      <Card className="col-span-1 rounded-none border-red-200 bg-red-50 shadow-sm">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <p className="text-sm font-semibold text-red-700 uppercase tracking-wider">Critical</p>
          <p className="text-4xl font-bold text-red-700 mt-2">{critical}</p>
        </CardContent>
      </Card>

      <Card className="col-span-1 rounded-none border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <p className="text-sm font-semibold text-amber-700 uppercase tracking-wider">Medium</p>
          <p className="text-4xl font-bold text-amber-700 mt-2">{medium}</p>
        </CardContent>
      </Card>

      <Card className="col-span-1 rounded-none border-blue-200 bg-blue-50 shadow-sm">
        <CardContent className="p-4 flex flex-col justify-center h-full">
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wider">Low</p>
          <p className="text-4xl font-bold text-blue-700 mt-2">{low}</p>
        </CardContent>
      </Card>

      <Card className="col-span-1 rounded-none border-slate-200 bg-slate-900 text-white shadow-sm overflow-hidden relative">
        <div 
          className="absolute inset-y-0 left-0 bg-green-500 opacity-20" 
          style={{ width: `${qualityScore}%` }} 
        />
        <CardContent className="p-4 flex flex-col justify-center h-full relative z-10">
          <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Quality Score</p>
          <div className="flex items-baseline gap-1 mt-2">
            <p className="text-4xl font-bold text-white">{Math.round(qualityScore)}</p>
            <p className="text-lg text-slate-400">/ 100</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
