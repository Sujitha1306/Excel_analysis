"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useValidation } from "@/components/ValidationProvider";

export default function UploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dropzoneKey, setDropzoneKey] = useState(0);
  const { setParsedWorkbook, resetValidation } = useValidation();

  React.useEffect(() => {
    // Ensure fresh dropzone
    if (typeof window !== 'undefined') {
      setDropzoneKey(prev => prev + 1);
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Clear previous validation data
    resetValidation();
    setError(null);
    setIsUploading(true);

    if (acceptedFiles.length === 0) {
      setIsUploading(false);
      return;
    }

    const file = acceptedFiles[0];
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/parse-excel', { 
        method: 'POST', 
        body: formData 
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to parse file on server');
      }

      const parsed = await res.json();
      
      if (!parsed.sheets || parsed.sheets.length === 0) {
        setError("Could not detect any valid sheets in this file.");
        setIsUploading(false);
        return;
      }
      
      // Store in context ref — no size limit
      setParsedWorkbook(parsed);
      router.push('/validate');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse the Excel file. It might be corrupted or password protected.");
      setIsUploading(false);
    }
  }, [router, resetValidation, setParsedWorkbook]);

  const onDropRejected = useCallback(() => {
    setError("Invalid file type. Please upload an .xlsx or .xls file.");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/zip': ['.xlsx'],
      'application/octet-stream': ['.xlsx', '.xls']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false
  });

  if (isUploading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-slate-800">Processing File...</h2>
          <p className="text-slate-500 mt-2">Uploading and analyzing structure</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-light text-brand mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ExcelAudit</h1>
          <p className="text-lg text-slate-600 mt-2">Validate Your Hospital Excel Data</p>
          <p className="text-sm text-slate-500 mt-1">Powered by AI + Rule Engine</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div 
            key={dropzoneKey}
            {...getRootProps()} 
            className={`p-12 text-center cursor-pointer transition-colors border-2 border-dashed m-4 rounded-xl
              ${isDragActive ? 'border-brand bg-brand-light/50' : 'border-slate-200 hover:border-brand/50 hover:bg-slate-50'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragActive ? 'text-brand' : 'text-slate-400'}`} />
            <p className="text-lg font-medium text-slate-900 mb-1">
              Drag & drop your .xlsx file
            </p>
            <p className="text-slate-500 mb-4">or click to browse</p>
            <div className="text-xs text-slate-400 font-mono">
              Supports: .xlsx, .xls up to 50MB
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-4 p-3 bg-critical-bg border border-critical-border rounded-md flex items-start text-critical-text text-sm">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 p-6 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              What gets checked
            </h3>
            <ul className="space-y-3">
              {[
                "Cross-sheet count consistency",
                "TAT arithmetic validation",
                "Missing & whitespace field detection",
                "Duplicate ID detection",
                "AI-powered anomaly detection"
              ].map((item, idx) => (
                <li key={idx} className="flex items-start text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-pass-border mr-3 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
