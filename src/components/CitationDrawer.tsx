import React, { useEffect } from 'react';
import { X, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { NormalizedReading, SourceRow } from '../types/vayu.ts';
import { getNaqiStyle } from '../utils/naqi.ts';

interface CitationDrawerProps {
  selectedRowIndices: number[] | null;
  sourceRows: SourceRow[];
  readings: NormalizedReading[];
  contextTitle?: string;
  onClose: () => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  selectedRowIndices,
  sourceRows,
  readings,
  contextTitle,
  onClose,
}) => {
  useEffect(() => {
    if (!selectedRowIndices) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedRowIndices, onClose]);

  if (!selectedRowIndices || selectedRowIndices.length === 0) {
    return null;
  }

  const matchedRows = selectedRowIndices
    .map((idx) => ({
      source: sourceRows.find((r) => r.rowIndex === idx),
      normalized: readings.find((r) => r.rowIndex === idx),
      rowIndex: idx,
    }))
    .filter((item) => item.source || item.normalized);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0f172a]/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citation-drawer-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-[0_24px_48px_-12px_rgba(20,83,45,0.2)] border-l border-[#16a34a]/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
              Source Traceability Inspector
            </p>
            <h2
              id="citation-drawer-title"
              className="mt-1 font-display text-xl font-semibold text-[#131b2e]"
            >
              {contextTitle || `Cited Input Records (${matchedRows.length})`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close traceability inspector"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#131b2e] focus-visible:outline-2 focus-visible:outline-[#16a34a]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {matchedRows.map(({ rowIndex, source, normalized }) => {
            const naqiStyle = getNaqiStyle(normalized?.naqiCategory || 'Unavailable');
            return (
              <div
                key={rowIndex}
                className="rounded-xl border border-slate-200 bg-[#faf8ff] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#00652c]" aria-hidden="true" />
                    <span className="font-mono text-sm font-semibold text-[#131b2e] tabular-nums">
                      Row #{rowIndex}
                    </span>
                    {normalized && (
                      <span className="text-xs text-[#3f493f]">
                        · {normalized.station} · {normalized.pollutant}
                      </span>
                    )}
                  </div>
                  {normalized && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${naqiStyle.bg} ${naqiStyle.text} ${naqiStyle.border}`}
                    >
                      {normalized.status === 'valid' ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      )}
                      {normalized.status === 'valid'
                        ? `${normalized.naqiCategory} (NAQI ${normalized.naqiSubIndex ?? '—'})`
                        : normalized.status === 'missing'
                          ? 'Missing / Gap'
                          : 'Anomaly / Outlier'}
                    </span>
                  )}
                </div>

                {source && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      Verbatim Raw Input Line
                    </p>
                    <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-[#131b2e] whitespace-pre-wrap break-all">
                      {source.rawText}
                    </pre>
                  </div>
                )}

                {normalized && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="font-semibold text-slate-500">Original Reading</p>
                      <p className="mt-1 font-mono text-sm text-[#131b2e] tabular-nums">
                        {normalized.rawValue || 'Empty'}{' '}
                        <span className="text-slate-500">{normalized.rawUnit}</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="font-semibold text-slate-500">Normalized (CPCB)</p>
                      <p className="mt-1 font-mono text-sm text-[#00652c] font-semibold tabular-nums">
                        {normalized.normalizedValue !== null
                          ? `${normalized.normalizedValue} ${normalized.normalizedUnit}`
                          : 'Not Imputed (Null)'}
                      </p>
                    </div>
                  </div>
                )}

                {normalized && (
                  <div className="text-xs text-[#3f493f] space-y-1">
                    <p>
                      <span className="font-semibold text-[#131b2e]">Timestamp ISO:</span>{' '}
                      <span className="font-mono tabular-nums">
                        {normalized.timestampIso || 'Unparseable / Missing'}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-[#131b2e]">Conversion Math:</span>{' '}
                      {normalized.conversionNote}
                    </p>
                    {normalized.issueNote && normalized.issueNote !== 'None' && (
                      <p className="text-[#93000a] font-medium">
                        <span className="font-semibold">Hygiene Flag:</span> {normalized.issueNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
