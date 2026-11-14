import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { NormalizationResult } from '../types/vayu.ts';
import { getNaqiStyle } from '../utils/naqi.ts';
import { DataIntegrityDashboard } from './DataIntegrityDashboard.tsx';
import { DataQualityCharts } from './DataQualityCharts.tsx';
import { HeatmapsPanel } from './HeatmapsPanel.tsx';
import { UnitConverterTool } from './UnitConverterTool.tsx';
import { VayuWordmark } from './VayuWordmark.tsx';

interface HygieneStepProps {
  normalization: NormalizationResult | null;
  onInspectRows: (rows: number[], title?: string) => void;
  onProceedToBriefs: () => void;
  onGoToIngest: () => void;
  isGeneratingBriefs: boolean;
}

type HygieneFilter = 'all' | 'anomalies' | 'gaps' | 'who_exceeded';

export const HygieneStep: React.FC<HygieneStepProps> = ({
  normalization,
  onInspectRows,
  onProceedToBriefs,
  onGoToIngest,
  isGeneratingBriefs,
}) => {
  const [filter, setFilter] = useState<HygieneFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReadings = useMemo(() => {
    if (!normalization) return [];
    const q = searchQuery.trim().toLowerCase();
    return normalization.readings.filter((r) => {
      if (filter === 'anomalies' && r.status !== 'anomaly') return false;
      if (filter === 'gaps' && r.status !== 'missing') return false;
      if (filter === 'who_exceeded' && !r.whoExceeded) return false;
      if (q) {
        const hay = `${r.station} ${r.pollutant} ${r.issueNote} ${r.naqiCategory}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [normalization, filter, searchQuery]);

  if (!normalization) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#15803d] border border-[#16a34a]/20">
          <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-[#131b2e]">
          Data Quality Dashboards Awaiting Input
        </h1>
        <p className="mx-auto max-w-md text-sm text-[#3f493f]">
          Vayu AI never displays placeholder charts or fake sensor metrics. Upload or paste raw
          air-quality data first to unlock all 5 data-quality graphs and row-level traceability.
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

  const overallStyle = getNaqiStyle(normalization.overallCategory);

  return (
    <section aria-labelledby="hygiene-heading" className="space-y-8">
      {/* Header row with distinct VAYU · AI ledger placement */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
            Step 02 · Data Quality Dashboards &amp; Traceability Matrix
          </p>
          <h1
            id="hygiene-heading"
            className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#131b2e]"
          >
            {normalization.datasetTitle}
          </h1>
          <p className="mt-1 text-sm text-[#3f493f]">
            Normalized to Indian NAQI (CPCB) standards with WHO 2021 threshold flags. Click any chart
            marker, table row, or citation to inspect the verbatim source record.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <VayuWordmark variant="hygiene" />
          <button
            type="button"
            disabled={isGeneratingBriefs}
            onClick={onProceedToBriefs}
            className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#00652c] disabled:bg-slate-300 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-[#16a34a] whitespace-nowrap"
          >
            {isGeneratingBriefs ? 'Generating Briefings...' : 'Generate Role & Citizen Briefs'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 5-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Overall CPCB NAQI</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[#131b2e] tabular-nums">
              {normalization.overallNaqi ?? '—'}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${overallStyle.bg} ${overallStyle.text} ${overallStyle.border}`}
            >
              {normalization.overallCategory}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Dominant: <span className="font-semibold text-[#131b2e]">{normalization.dominantPollutant}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Verified Readings</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#00652c] tabular-nums">
            {normalization.validCount}{' '}
            <span className="text-sm font-normal text-slate-500">/ {normalization.totalSourceRows}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Normalized to CPCB units</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Missing / Sensor Gaps</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#b45309] tabular-nums">
            {normalization.gapCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Left null — never imputed</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Anomalies &amp; Spikes</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#ba1a1a] tabular-nums">
            {normalization.anomalyCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Outliers &amp; negative faults</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Data Confidence</p>
          <div className="mt-2 flex items-center gap-2">
            {normalization.overallConfidence === 'High' ? (
              <ShieldCheck className="h-5 w-5 text-[#15803d]" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-[#b45309]" aria-hidden="true" />
            )}
            <span className="font-display text-2xl font-bold text-[#131b2e]">
              {normalization.overallConfidence}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {normalization.issues.length} hygiene flag(s) logged
          </p>
        </div>
      </div>

      {/* Dynamic Recharts Data Integrity Dashboard (Dropouts & Anomaly Frequency) */}
      <DataIntegrityDashboard normalization={normalization} onInspectRows={onInspectRows} />

      {/* Interactive Heatmaps */}
      <HeatmapsPanel normalization={normalization} onInspectRows={onInspectRows} />

      {/* Interactive 5-Chart Data Quality Dashboard */}
      <DataQualityCharts normalization={normalization} onInspectRows={onInspectRows} />

      {/* Pollutant Unit Converter Tool */}
      <UnitConverterTool />

      {/* Station Summaries */}
      {normalization.stationSummaries.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#131b2e]">
            Station &amp; Zone Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {normalization.stationSummaries.map((st) => {
              const stStyle = getNaqiStyle(st.peakCategory);
              return (
                <div
                  key={st.station}
                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm text-[#131b2e]">{st.station}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${stStyle.bg} ${stStyle.text} ${stStyle.border}`}
                      >
                        {st.peakCategory}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-[#3f493f] tabular-nums">
                      Peak NAQI: {st.peakNaqi ?? 'N/A'} · Dominant: {st.dominantPollutant}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {st.validCount} valid · {st.gapCount} gaps · {st.anomalyCount} anomalies ·{' '}
                      {st.whoExceedanceCount} WHO exceedances
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectRows(st.citedRows, `${st.station} — Cited Rows`)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00652c] hover:underline w-fit focus-visible:outline-2 focus-visible:outline-[#16a34a] rounded"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Inspect {st.citedRows.length} source rows
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Split: Normalized Table (8 cols) + Anomaly & Gap Ledger (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#f2f3ff] p-1">
              {(
                [
                  { id: 'all', label: `All (${normalization.readings.length})` },
                  { id: 'anomalies', label: `Anomalies (${normalization.anomalyCount})` },
                  { id: 'gaps', label: `Gaps (${normalization.gapCount})` },
                  {
                    id: 'who_exceeded',
                    label: `WHO Exceeded (${normalization.readings.filter((r) => r.whoExceeded).length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-white text-[#00652c] shadow-sm'
                      : 'text-[#3f493f] hover:text-[#131b2e]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter station or pollutant..."
                aria-label="Filter normalized readings"
                className="w-full sm:w-56 rounded-full border border-slate-200 bg-[#faf8ff] py-1.5 pl-8 pr-3 text-xs text-[#131b2e] placeholder:text-slate-400 focus:border-[#16a34a] focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#faf8ff] border-b border-slate-200 text-[#3f493f]">
                <tr>
                  <th className="px-4 py-3 font-mono font-semibold">Row</th>
                  <th className="px-4 py-3 font-semibold">Timestamp (ISO)</th>
                  <th className="px-4 py-3 font-semibold">Station</th>
                  <th className="px-4 py-3 font-semibold">Pollutant</th>
                  <th className="px-4 py-3 font-semibold text-right">Raw → CPCB</th>
                  <th className="px-4 py-3 font-semibold text-right">NAQI</th>
                  <th className="px-4 py-3 font-semibold">Status &amp; WHO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReadings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No readings match the active filter.
                    </td>
                  </tr>
                ) : (
                  filteredReadings.map((r) => {
                    const style = getNaqiStyle(r.naqiCategory);
                    return (
                      <tr
                        key={r.rowIndex}
                        onClick={() => onInspectRows([r.rowIndex], `Row #${r.rowIndex} Traceability`)}
                        className="cursor-pointer transition-colors hover:bg-[#f0fdf4]/60"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-[#00652c] tabular-nums whitespace-nowrap">
                          #{r.rowIndex}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {r.timestampIso || (
                            <span className="text-[#b45309] font-medium">Missing TS</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#131b2e]">{r.station}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-[#131b2e]">
                          {r.pollutant}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-slate-400">
                            {r.rawValue || '—'} {r.rawUnit}
                          </span>{' '}
                          <span aria-hidden="true" className="text-slate-400">
                            →
                          </span>{' '}
                          <span className="font-semibold text-[#131b2e]">
                            {r.normalizedValue !== null
                              ? `${r.normalizedValue} ${r.normalizedUnit}`
                              : 'Null'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text} ${style.border}`}
                          >
                            {r.naqiSubIndex ?? '—'} · {r.naqiCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {r.status === 'valid' ? (
                              <span className="inline-flex items-center gap-1 text-[#15803d] font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Valid
                              </span>
                            ) : r.status === 'missing' ? (
                              <span className="inline-flex items-center gap-1 text-[#b45309] font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                Gap
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#ba1a1a] font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                Anomaly
                              </span>
                            )}
                            {r.whoExceeded && (
                              <span className="text-[11px] font-semibold text-[#93000a]">
                                · WHO Exceeded
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Anomaly & Gap Ledger */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-lg font-semibold text-[#131b2e]">
              Anomaly &amp; Gap Ledger
            </h2>
            <p className="text-xs text-slate-500">
              Unreliable intervals, format errors, and calibration spikes flagged explicitly
            </p>
          </div>

          {normalization.issues.length === 0 ? (
            <div className="rounded-xl bg-[#f0fdf4] border border-[#16a34a]/20 p-4 text-xs text-[#14532d]">
              All rows passed unit, timestamp, and plausibility verification with zero hygiene flags.
            </div>
          ) : (
            <div className="space-y-3">
              {normalization.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-xl border border-slate-200 bg-[#faf8ff] p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-[#131b2e]">{issue.title}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        issue.severity === 'outlier'
                          ? 'bg-[#ffdad6] text-[#93000a]'
                          : issue.severity === 'gap'
                            ? 'bg-[#fef9c3] text-[#854d0e]'
                            : 'bg-[#eaedff] text-[#131b2e]'
                      }`}
                    >
                      {issue.severity.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#3f493f] leading-relaxed">{issue.explanation}</p>
                  <p className="text-[11px] text-slate-600">
                    <span className="font-semibold text-[#131b2e]">Impact:</span>{' '}
                    {issue.reliabilityImpact}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {issue.affectedRows.map((rowId) => (
                      <button
                        key={rowId}
                        type="button"
                        onClick={() => onInspectRows(issue.affectedRows, issue.title)}
                        className="rounded border border-[#16a34a]/30 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#00652c] hover:bg-[#f0fdf4] focus-visible:outline-2 focus-visible:outline-[#16a34a]"
                      >
                        Row #{rowId}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
