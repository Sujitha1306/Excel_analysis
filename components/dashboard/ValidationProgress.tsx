"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";

interface ValidationProgressProps {
  progress: number;
  currentStep: string;
}

export function ValidationProgress({ progress, currentStep }: ValidationProgressProps) {
  const steps = [
    "Parsing Excel Structure",
    "Running Core Validation Rules",
    "Cross-referencing Sheets",
    "AI Enrichment via Claude/Gemini",
    "Finalizing Report"
  ];

  const currentIdx = steps.findIndex(s => currentStep.includes(s)) || 0;
  // Fallback to progress based index if currentStep doesn't match perfectly
  const activeIdx = currentIdx >= 0 ? currentIdx : Math.floor((progress / 100) * steps.length);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 max-w-md mx-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full text-center mb-12"
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing Data</h2>
        <p className="text-slate-500">Please wait while we audit the hospital porter records.</p>
      </motion.div>

      <div className="w-full mb-10">
        <div className="h-2 w-full bg-slate-100 overflow-hidden">
          <motion.div 
            className="h-full bg-indigo-600"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeInOut", duration: 0.5 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
          <span>0%</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="w-full space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIdx || progress === 100;
          const isActive = idx === activeIdx && progress < 100;

          return (
            <div key={step} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                isCompleted ? 'bg-green-100 text-green-600' : 
                isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-300'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 size={18} />
                ) : isActive ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Loader2 size={18} />
                  </motion.div>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                )}
              </div>
              
              <span className={`text-sm font-medium transition-colors ${
                isCompleted ? 'text-slate-900' : 
                isActive ? 'text-indigo-700 font-bold' : 'text-slate-400'
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
