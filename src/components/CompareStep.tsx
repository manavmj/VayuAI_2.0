import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  FileSpreadsheet,
  Flame,
  GitCompare,
  History,
  Trash2,
} from 'lucide-react';
import type {
  ComparisonResult,
  ComparisonZoneDelta,
  NormalizationResult,
  SavedBriefSnapshot,
} from '../types/vayu.ts';
import { VayuWordmark } from './VayuWordmark.tsx';

interface CompareStepProps {
  currentNormalization: NormalizationResult | null;
  savedSnapshots: SavedBriefSnapshot[];
  onDeleteSnapshot: (id: string) => void;
  onRunComparison: (previousLabel: string, previousContent: string) => Promise<void>;
  comparisonResult: ComparisonResult | null;
  isComparing: boolean;
  compareError: string | null;
  onInspectRows: (rows: number[], title?: string) => void;
  onGoToIngest: () => void;
}

export const CompareStep: React.FC<CompareStepProps> = ({
  currentNormalization,
  savedSnapshots,
  onDeleteSnapshot,
  onRunComparison,
  comparisonResult,
  isComparing,
  compareError,
  onInspectRows,
  onGoToIngest,
}) => {
  const [mode, setMode] = useState<'saved' | 'paste'>(
    savedSnapshots.length > 0 ? 'saved' : 'paste'
  );
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(
    savedSnapshots[0]?.id || ''
  );
  const [pastedLabel, setPastedLabel] = useState('Previous Day / Shift Report');
  const [pastedReport, setPastedReport] = useState('');

  if (!currentNormalization) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#15803d] border border-[#16a34a]/20">
          <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-[#131b2e]">
          Historical Comparison Needs a Current Dataset
        </h1>
        <p className="mx-auto max-w-md text-sm text-[#3f493f]">
          Load and normalize a current air-quality batch first so Vayu AI can compare it against
          saved briefings or a pasted baseline report.
        </p>
        <button
          type="button"
          onClick={onGoToIngest}
          className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00652c]"
        >
          Go to Data Ingestion
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'saved') {
      const snap = savedSnapshots.find((s) => s.id === selectedSnapshotId);
      if (!snap) return;
      const serialized = JSON.stringify({
        datasetTitle: snap.normalization.datasetTitle,
        savedAt: snap.savedAt,
        overallNaqi: snap.normalization.overallNaqi,
        overallCategory: snap.normalization.overallCategory,
        stationSummaries: snap.normalization.stationSummaries,
        executiveSummary: snap.internalBriefing.executiveSummary,
      });
      await onRunComparison(snap.label, serialized);
    } else {
      await onRunComparison(pastedLabel || 'Pasted Previous Report', pastedReport);
    }
  };

  const renderZoneList = (
    title: string,
    items: ComparisonZoneDelta[],
    icon: React.ReactNode,
    toneClass: string
  ) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-base font-semibold text-[#131b2e]">{title}</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 py-3">No zones matched this category.</p>
      ) : (
        <div className="space-y-3">
          {items.map((z, idx) => (
            <div
              key={`${z.station}-${idx}`}
              className={`rounded-xl border p-3.5 space-y-2 ${toneClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#131b2e]">{z.station}</span>
                {z.citedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onInspectRows(z.citedRows, `${z.station} — Delta Evidence`)}
                    className="rounded border border-[#16a34a]/30 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#00652c] hover:bg-[#f0fdf4]"
                  >
                    Rows {z.citedRows.map((r) => `#${r}`).join(', ')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                <div className="rounded bg-white/80 px-2.5 py-1.5 border border-slate-200/70">
                  <span className="block text-[10px] uppercase text-slate-500 font-sans">
                    Previous
                  </span>
                  <span className="text-[#131b2e]">{z.previousValue}</span>
                </div>
                <div className="rounded bg-white/80 px-2.5 py-1.5 border border-slate-200/70">
                  <span className="block text-[10px] uppercase text-slate-500 font-sans">
                    Current
                  </span>
                  <span className="font-semibold text-[#131b2e]">{z.currentValue}</span>
                </div>
              </div>
              <p className="text-xs text-[#3f493f] leading-relaxed">{z.deltaNote}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section aria-labelledby="compare-heading" className="space-y-8">
      {/* Header with Vayu ⇄ AI mark */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <VayuWordmark variant="compare" />
          <h1
            id="compare-heading"
            className="font-display text-2xl sm:text-3xl font-semibold text-[#131b2e]"
          >
            Historical Comparison (“What Changed”)
          </h1>
          <p className="text-sm text-[#3f493f]">
            Compare{' '}
            <span className="font-semibold text-[#131b2e]">
              {currentNormalization.datasetTitle}
            </span>{' '}
            against a saved brief from this browser or a pasted earlier report.
          </p>
        </div>
      </div>

      {/* Baseline Selector Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-[#131b2e]">
            Select Baseline Report
          </h2>
          <div className="inline-flex rounded-lg bg-[#f2f3ff] p-1">
            <button
              type="button"
              onClick={() => setMode('saved')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'saved' ? 'bg-white text-[#00652c] shadow-sm' : 'text-[#3f493f]'
              }`}
            >
              Saved Briefs ({savedSnapshots.length})
            </button>
            <button
              type="button"
              onClick={() => setMode('paste')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'paste' ? 'bg-white text-[#00652c] shadow-sm' : 'text-[#3f493f]'
              }`}
            >
              Paste Previous Report
            </button>
          </div>
        </div>

        {mode === 'saved' ? (
          savedSnapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-[#faf8ff] p-6 text-center space-y-2">
              <History className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-medium text-[#131b2e]">
                No saved briefs in browser storage yet
              </p>
              <p className="text-xs text-slate-500">
                Save a brief in Step 03 (Briefs &amp; Roles) or switch to &ldquo;Paste Previous
                Report&rdquo; above to compare against any historical summary.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {savedSnapshots.map((snap) => {
                const selected = selectedSnapshotId === snap.id;
                return (
                  <div
                    key={snap.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                      selected
                        ? 'border-[#16a34a] bg-[#f0fdf4]/70'
                        : 'border-slate-200 bg-[#faf8ff] hover:border-slate-300'
                    }`}
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="saved-snapshot"
                        checked={selected}
                        onChange={() => setSelectedSnapshotId(snap.id)}
                        className="mt-1 h-4 w-4 accent-[#16a34a]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#131b2e]">{snap.label}</p>
                        <p className="text-xs text-slate-500 font-mono tabular-nums">
                          Saved {new Date(snap.savedAt).toLocaleString()} · NAQI{' '}
                          {snap.normalization.overallNaqi ?? 'N/A'} (
                          {snap.normalization.overallCategory})
                        </p>
                      </div>
                    </label>
                    <button
                      type="button"
                      aria-label={`Delete saved brief ${snap.label}`}
                      onClick={() => onDeleteSnapshot(snap.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-[#ba1a1a]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="prev-label"
                className="block text-xs font-semibold uppercase tracking-[0.04em] text-[#3f493f]"
              >
                Previous Report Label
              </label>
              <input
                id="prev-label"
                type="text"
                value={pastedLabel}
                onChange={(e) => setPastedLabel(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="prev-report-text"
                className="block text-xs font-semibold uppercase tracking-[0.04em] text-[#3f493f]"
              >
                Paste Previous Report / Briefing / Station Readout
              </label>
              <textarea
                id="prev-report-text"
                rows={5}
                value={pastedReport}
                onChange={(e) => setPastedReport(e.target.value)}
                placeholder="Paste a previous briefing note, station summary, or historical table (e.g., 'Anand Vihar PM2.5 was 195 µg/m³, Rohini Sector 11 PM2.5 was 165 µg/m³...')"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#faf8ff] p-3.5 font-mono text-xs text-[#131b2e] placeholder:text-slate-400 focus:border-[#16a34a] focus:outline-none"
              />
            </div>
          </div>
        )}

        {compareError && (
          <p role="alert" className="text-xs font-semibold text-[#ba1a1a]">
            {compareError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              isComparing ||
              (mode === 'saved' && (!selectedSnapshotId || savedSnapshots.length === 0)) ||
              (mode === 'paste' && !pastedReport.trim())
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#00652c] disabled:bg-slate-300 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-[#16a34a]"
          >
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            {isComparing ? 'Comparing Baselines...' : 'Run Grounded Delta Comparison'}
          </button>
        </div>
      </form>

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#16a34a]/20 bg-[#f0fdf4]/60 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
              {comparisonResult.baselineLabel} → {comparisonResult.currentLabel}
            </p>
            <p className="text-sm leading-relaxed text-[#131b2e]">
              {comparisonResult.executiveDelta}
            </p>
            {comparisonResult.dataQualityCaveat && (
              <p className="text-xs text-[#854d0e] font-medium pt-1">
                Caveat: {comparisonResult.dataQualityCaveat}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {renderZoneList(
              'Worsening Zones',
              comparisonResult.worseningZones,
              <ArrowUpRight className="h-5 w-5 text-[#ba1a1a]" aria-hidden="true" />,
              'border-[#fca5a5] bg-[#fee2e2]/35'
            )}
            {renderZoneList(
              'Improving Zones',
              comparisonResult.improvingZones,
              <ArrowDownRight className="h-5 w-5 text-[#15803d]" aria-hidden="true" />,
              'border-[#bbf7d0] bg-[#dcfce7]/40'
            )}
            {renderZoneList(
              'Persistent Hotspots',
              comparisonResult.persistentHotspots,
              <Flame className="h-5 w-5 text-[#b45309]" aria-hidden="true" />,
              'border-[#fde047] bg-[#fef9c3]/40'
            )}
          </div>
        </div>
      )}
    </section>
  );
};
