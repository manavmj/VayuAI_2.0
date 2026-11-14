import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Sparkles, Trash2, AlertCircle, ArrowRight } from 'lucide-react';
import type { SourceRow } from '../types/vayu.ts';
import {
  MESSY_TEST_FIXTURE,
  parseFileToSourceRows,
  parseRawTextToSourceRows,
} from '../utils/parser.ts';
import { VayuWordmark } from './VayuWordmark.tsx';

interface IngestStepProps {
  datasetTitle: string;
  onChangeTitle: (title: string) => void;
  rawInputText: string;
  sourceRows: SourceRow[];
  detectedFormat: string;
  truncatedCount: number;
  onUpdateParsedInput: (payload: {
    rawText: string;
    rows: SourceRow[];
    detectedFormat: string;
    truncatedCount: number;
    suggestedTitle?: string;
  }) => void;
  onNormalize: () => void;
  isNormalizing: boolean;
  errorMessage: string | null;
}

export const IngestStep: React.FC<IngestStepProps> = ({
  datasetTitle,
  onChangeTitle,
  rawInputText,
  sourceRows,
  detectedFormat,
  truncatedCount,
  onUpdateParsedInput,
  onNormalize,
  isNormalizing,
  errorMessage,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleTextChange = (text: string) => {
    setFileError(null);
    const parsed = parseRawTextToSourceRows(text);
    onUpdateParsedInput({
      rawText: text,
      rows: parsed.rows,
      detectedFormat: parsed.detectedFormat,
      truncatedCount: parsed.truncatedCount,
    });
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File exceeds the 5 MB limit. Please upload a smaller slice.');
      }
      const parsed = await parseFileToSourceRows(file);
      onUpdateParsedInput({
        rawText: parsed.rawPreviewText,
        rows: parsed.rows,
        detectedFormat: parsed.detectedFormat,
        truncatedCount: parsed.truncatedCount,
        suggestedTitle: file.name.replace(/\.[^.]+$/, ''),
      });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unable to read the uploaded file.');
    }
  };

  const handleLoadFixture = () => {
    setFileError(null);
    const parsed = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
    onUpdateParsedInput({
      rawText: MESSY_TEST_FIXTURE,
      rows: parsed.rows,
      detectedFormat: parsed.detectedFormat,
      truncatedCount: parsed.truncatedCount,
      suggestedTitle: 'Delhi Multi-Ward Morning Log (Messy Fixture)',
    });
  };

  const handleClear = () => {
    setFileError(null);
    onUpdateParsedInput({
      rawText: '',
      rows: [],
      detectedFormat: 'empty',
      truncatedCount: 0,
      suggestedTitle: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const previewColumns =
    sourceRows.length > 0 ? Object.keys(sourceRows[0].rawFields).slice(0, 6) : [];

  return (
    <section aria-labelledby="ingest-heading" className="space-y-8">
      {/* Asymmetric Civic Vitality Hero Banner */}
      <div className="rounded-[2.5rem_0.75rem_2.5rem_0.75rem] border border-[#16a34a]/15 bg-gradient-to-br from-[#ffffff] via-[#f0fdf4]/70 to-[#f2f3ff] p-6 sm:p-10 shadow-[0_12px_32px_-4px_rgba(21,128,61,0.08)]">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <VayuWordmark variant="ingest" />
            <h1
              id="ingest-heading"
              className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#131b2e] text-balance"
            >
              Turn uncleaned air-quality logs into verified CPCB briefings without guesswork.
            </h1>
            <p className="text-sm sm:text-base text-[#3f493f] leading-relaxed max-w-[68ch]">
              Paste messy sensor tables or upload CSV and Excel spreadsheets. Every unit conversion,
              missing interval, spike flag, and advisory claim stays anchored to exact input row numbers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLoadFixture}
              className="inline-flex items-center gap-2 rounded-lg border border-[#16a34a]/30 bg-[#f0fdf4] px-4 py-2.5 text-sm font-semibold text-[#15803d] transition-colors hover:bg-[#dcfce7] focus-visible:outline-2 focus-visible:outline-[#16a34a] whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Load Messy Test Fixture
            </button>
            {sourceRows.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#16a34a] whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {(errorMessage || fileError) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6]/50 px-4 py-3.5 text-sm text-[#93000a]"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Input Processing Error</p>
            <p className="mt-0.5">{fileError || errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main 12-column ingestion workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 columns: Upload + Paste */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-6 space-y-5">
          <div>
            <label
              htmlFor="dataset-title-input"
              className="block text-xs font-semibold uppercase tracking-[0.04em] text-[#3f493f]"
            >
              Monitoring Batch Label
            </label>
            <input
              id="dataset-title-input"
              type="text"
              value={datasetTitle}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="e.g., East Zone Morning Ward Log — Nov 14"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2.5 text-sm text-[#131b2e] placeholder:text-slate-400 focus:border-[#16a34a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
            />
          </div>

          {/* Drag & drop file upload */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-[0.04em] text-[#3f493f]">
              Upload CSV or Excel Spreadsheet
            </span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) void handleFile(droppedFile);
              }}
              className={`mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
                isDragging
                  ? 'border-[#16a34a] bg-[#f0fdf4]'
                  : 'border-slate-300 bg-[#faf8ff] hover:border-[#16a34a]/50'
              }`}
            >
              <FileSpreadsheet className="h-7 w-7 text-[#15803d]" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-[#131b2e]">
                Drag and drop <span className="font-mono text-xs">.csv</span>,{' '}
                <span className="font-mono text-xs">.xlsx</span>, or{' '}
                <span className="font-mono text-xs">.xls</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Processed locally into row-indexed records before CPCB normalization (max 150 rows).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv,.txt"
                aria-label="Upload CSV or Excel air quality file"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void handleFile(chosen);
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#16a34a]/30 bg-white px-4 py-2 text-xs font-semibold text-[#15803d] hover:bg-[#f0fdf4] focus-visible:outline-2 focus-visible:outline-[#16a34a]"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Choose File
              </button>
            </div>
          </div>

          {/* Paste raw table/text */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="raw-paste-input"
                className="block text-xs font-semibold uppercase tracking-[0.04em] text-[#3f493f]"
              >
                Or Paste Raw Table / Sensor Text
              </label>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {sourceRows.length > 0
                  ? `${sourceRows.length} indexed rows (${detectedFormat})`
                  : 'Empty — awaiting input'}
              </span>
            </div>
            <textarea
              id="raw-paste-input"
              rows={9}
              value={rawInputText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste CSV, tab-separated Excel rows, markdown tables, or messy field logs here. Mixed units (µg/m³, ppm, ppb, mg/m³) and missing cells are handled automatically."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#faf8ff] p-3.5 font-mono text-xs leading-relaxed text-[#131b2e] placeholder:text-slate-400 focus:border-[#16a34a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
            />
            {truncatedCount > 0 && (
              <p className="mt-1.5 text-xs text-[#b45309] font-medium">
                Note: Input exceeded 150 rows; showing and normalizing the first 150 rows ({truncatedCount} omitted).
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              No synthetic values will be generated for empty or missing cells.
            </p>
            <button
              type="button"
              disabled={sourceRows.length === 0 || isNormalizing}
              onClick={onNormalize}
              className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#00652c] hover:shadow-[0_8px_20px_-2px_rgba(22,163,74,0.35)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-[#16a34a]"
            >
              {isNormalizing ? 'Normalizing & Auditing...' : 'Normalize & Audit Hygiene'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right 5 columns: Deterministic Source Index Preview (strict empty state if no input) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#131b2e]">
                Indexed Input Preview
              </h2>
              <p className="text-xs text-slate-500">
                Immutable row anchors used for traceability citations
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-[#00652c] tabular-nums">
              {sourceRows.length} rows
            </span>
          </div>

          {sourceRows.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#15803d] border border-[#16a34a]/15">
                <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-base font-semibold text-[#131b2e]">
                No sensor data loaded yet
              </h3>
              <p className="mx-auto max-w-xs text-xs text-slate-500 leading-relaxed">
                Vayu AI never displays placeholder or fabricated readings. Upload a CSV/Excel file,
                paste raw tables on the left, or click Load Messy Test Fixture to inspect how noisy data is handled.
              </p>
            </div>
          ) : (
            <div className="mt-4 max-h-[430px] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-[#f2f3ff] text-[#131b2e] border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-mono font-semibold whitespace-nowrap">Row</th>
                    {previewColumns.map((col) => (
                      <th key={col} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sourceRows.slice(0, 30).map((row) => (
                    <tr key={row.rowIndex} className="hover:bg-[#f0fdf4]/50">
                      <td className="px-3 py-2 font-mono font-semibold text-[#00652c] tabular-nums">
                        #{row.rowIndex}
                      </td>
                      {previewColumns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 font-mono text-slate-700 max-w-[140px] truncate"
                          title={row.rawFields[col] || ''}
                        >
                          {row.rawFields[col] ? (
                            row.rawFields[col]
                          ) : (
                            <span className="text-slate-400 italic">empty</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sourceRows.length > 30 && (
                <div className="border-t border-slate-100 bg-[#faf8ff] px-3 py-2 text-center text-[11px] text-slate-500">
                  Showing first 30 of {sourceRows.length} indexed rows
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
