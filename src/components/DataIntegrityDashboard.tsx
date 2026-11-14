import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { NormalizationResult, NormalizedReading } from '../types/vayu.ts';

interface DataIntegrityDashboardProps {
  normalization: NormalizationResult;
  onInspectRows: (rows: number[], title?: string) => void;
}

type GroupingMode = 'sequence' | 'station' | 'pollutant';
type MetricMode = 'counts' | 'rates';

interface IntegrityBucket {
  label: string;
  totalRows: number;
  validCount: number;
  dropoutCount: number;
  anomalyCount: number;
  missingTsCount: number;
  integrityRate: number;
  dropoutRate: number;
  anomalyRate: number;
  rowIds: number[];
  flaggedRowIds: number[];
}

function buildBucket(label: string, items: NormalizedReading[]): IntegrityBucket {
  const totalRows = items.length;
  const validCount = items.filter((r) => r.status === 'valid').length;
  const dropoutCount = items.filter((r) => r.status === 'missing').length;
  const anomalyCount = items.filter((r) => r.status === 'anomaly').length;
  const missingTsCount = items.filter((r) => !r.timestampIso).length;
  const denom = Math.max(1, totalRows);

  return {
    label,
    totalRows,
    validCount,
    dropoutCount,
    anomalyCount,
    missingTsCount,
    integrityRate: Math.round((validCount / denom) * 100),
    dropoutRate: Math.round((dropoutCount / denom) * 100),
    anomalyRate: Math.round((anomalyCount / denom) * 100),
    rowIds: items.map((r) => r.rowIndex),
    flaggedRowIds: items.filter((r) => r.status !== 'valid' || !r.timestampIso).map((r) => r.rowIndex),
  };
}

interface TooltipPayloadEntry {
  payload?: IntegrityBucket;
}

const IntegrityTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  metricMode: MetricMode;
}> = ({ active, payload, metricMode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  return (
    <div className="rounded-xl border border-[#16a34a]/25 bg-white p-3 shadow-[0_12px_32px_-4px_rgba(21,128,61,0.15)] text-xs space-y-1.5">
      <p className="font-display font-semibold text-[#131b2e]">{bucket.label}</p>
      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
        Rows: {bucket.rowIds.map((id) => `#${id}`).join(', ')}
      </p>
      <div className="space-y-1 pt-1 border-t border-slate-100 font-mono tabular-nums">
        <p className="text-[#15803d]">
          Integrity: {bucket.integrityRate}% ({bucket.validCount}/{bucket.totalRows} valid)
        </p>
        <p className="text-[#b45309]">
          Sensor Dropouts: {bucket.dropoutCount}
          {metricMode === 'rates' ? ` (${bucket.dropoutRate}%)` : ''}
        </p>
        <p className="text-[#ba1a1a]">
          Anomaly Spikes: {bucket.anomalyCount}
          {metricMode === 'rates' ? ` (${bucket.anomalyRate}%)` : ''}
        </p>
        {bucket.missingTsCount > 0 && (
          <p className="text-slate-600">Timestamp Gaps: {bucket.missingTsCount}</p>
        )}
      </div>
    </div>
  );
};

export const DataIntegrityDashboard: React.FC<DataIntegrityDashboardProps> = React.memo(({
  normalization,
  onInspectRows,
}) => {
  const [grouping, setGrouping] = useState<GroupingMode>('sequence');
  const [metricMode, setMetricMode] = useState<MetricMode>('counts');
  const [selectedStation, setSelectedStation] = useState<string>('all');

  const stations = useMemo(() => {
    const unique = new Set(normalization.readings.map((r) => r.station));
    return Array.from(unique);
  }, [normalization.readings]);

  const filteredReadings = useMemo(() => {
    if (selectedStation === 'all') return normalization.readings;
    return normalization.readings.filter((r) => r.station === selectedStation);
  }, [normalization.readings, selectedStation]);

  const trendBuckets = useMemo(() => {
    if (filteredReadings.length === 0) return [];

    if (grouping === 'station') {
      const map = new Map<string, NormalizedReading[]>();
      for (const r of filteredReadings) {
        const list = map.get(r.station) ?? [];
        list.push(r);
        map.set(r.station, list);
      }
      return Array.from(map.entries()).map(([station, list]) => buildBucket(station, list));
    }

    if (grouping === 'pollutant') {
      const map = new Map<string, NormalizedReading[]>();
      for (const r of filteredReadings) {
        const key = r.pollutant.toUpperCase();
        const list = map.get(key) ?? [];
        list.push(r);
        map.set(key, list);
      }
      return Array.from(map.entries()).map(([pollutant, list]) => buildBucket(pollutant, list));
    }

    // Dynamic sequence bucketing based on dataset length (between 4 and 10 intervals)
    const targetBuckets = Math.min(10, Math.max(3, Math.ceil(filteredReadings.length / 3)));
    const bucketSize = Math.max(1, Math.ceil(filteredReadings.length / targetBuckets));
    const buckets: IntegrityBucket[] = [];

    for (let i = 0; i < filteredReadings.length; i += bucketSize) {
      const slice = filteredReadings.slice(i, i + bucketSize);
      const firstRow = slice[0].rowIndex;
      const lastRow = slice[slice.length - 1].rowIndex;
      const label = firstRow === lastRow ? `Row #${firstRow}` : `Rows #${firstRow}–#${lastRow}`;
      buckets.push(buildBucket(label, slice));
    }
    return buckets;
  }, [filteredReadings, grouping]);

  const stationBreakdown = useMemo(() => {
    const map = new Map<string, NormalizedReading[]>();
    for (const r of normalization.readings) {
      const list = map.get(r.station) ?? [];
      list.push(r);
      map.set(r.station, list);
    }
    return Array.from(map.entries()).map(([station, list]) => buildBucket(station, list));
  }, [normalization.readings]);

  const summaryStats = useMemo(() => {
    const total = Math.max(1, filteredReadings.length);
    const valid = filteredReadings.filter((r) => r.status === 'valid').length;
    const dropouts = filteredReadings.filter((r) => r.status === 'missing').length;
    const anomalies = filteredReadings.filter((r) => r.status === 'anomaly').length;
    const tsIssues = filteredReadings.filter((r) => !r.timestampIso).length;

    const worstStation = [...stationBreakdown].sort(
      (a, b) => b.dropoutCount + b.anomalyCount - (a.dropoutCount + a.anomalyCount)
    )[0];

    return {
      integrityPct: Math.round((valid / total) * 100),
      dropoutPct: Math.round((dropouts / total) * 100),
      anomalyPct: Math.round((anomalies / total) * 100),
      dropouts,
      anomalies,
      tsIssues,
      worstStation,
    };
  }, [filteredReadings, stationBreakdown]);

  return (
    <section
      aria-labelledby="data-integrity-heading"
      className="rounded-2xl border border-[#16a34a]/20 bg-white p-6 space-y-6"
    >
      {/* Header & Dynamic Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span>Dynamic Data Integrity Monitor</span>
          </div>
          <h2
            id="data-integrity-heading"
            className="font-display text-xl font-semibold text-[#131b2e]"
          >
            Sensor Dropouts &amp; Anomaly Frequency Trends
          </h2>
          <p className="text-xs text-[#3f493f]">
            Interactive Recharts telemetry auditing missing readings, calibration spikes, and
            integrity percentage across your uploaded batch. Click any bar to inspect raw rows.
          </p>
        </div>

        {/* Interactive Filter & Mode Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="integrity-station-filter" className="sr-only">
              Filter Data Integrity by Station
            </label>
            <select
              id="integrity-station-filter"
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-1.5 text-xs font-semibold text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
            >
              <option value="all">All Stations ({normalization.readings.length} rows)</option>
              {stations.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex rounded-lg bg-[#f2f3ff] p-1">
            {(
              [
                { id: 'sequence', label: 'Row Sequence' },
                { id: 'station', label: 'By Station' },
                { id: 'pollutant', label: 'By Pollutant' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGrouping(opt.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  grouping === opt.id ? 'bg-white text-[#00652c] shadow-sm' : 'text-[#3f493f]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg bg-[#f2f3ff] p-1">
            <button
              type="button"
              onClick={() => setMetricMode('counts')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                metricMode === 'counts' ? 'bg-white text-[#00652c] shadow-sm' : 'text-[#3f493f]'
              }`}
            >
              Counts
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('rates')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                metricMode === 'rates' ? 'bg-white text-[#00652c] shadow-sm' : 'text-[#3f493f]'
              }`}
            >
              Rates (%)
            </button>
          </div>
        </div>
      </div>

      {/* Integrity Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-[#f0fdf4]/50 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#14532d]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Batch Integrity Rate</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-[#00652c] tabular-nums">
            {summaryStats.integrityPct}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-[#fef9c3]/40 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#854d0e]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sensor Dropout Rate</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-[#b45309] tabular-nums">
            {summaryStats.dropoutPct}%{' '}
            <span className="text-xs font-mono font-normal">({summaryStats.dropouts} gaps)</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-[#ffdad6]/40 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#93000a]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Anomaly Frequency</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-[#ba1a1a] tabular-nums">
            {summaryStats.anomalyPct}%{' '}
            <span className="text-xs font-mono font-normal">
              ({summaryStats.anomalies} spikes)
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-[#faf8ff] p-3.5">
          <p className="text-xs font-medium text-slate-500">Highest Fault Concentration</p>
          <p className="mt-1 text-sm font-semibold text-[#131b2e] truncate">
            {summaryStats.worstStation &&
            summaryStats.worstStation.dropoutCount + summaryStats.worstStation.anomalyCount > 0
              ? summaryStats.worstStation.label
              : 'No Faulty Zone'}
          </p>
          <p className="text-[11px] font-mono text-slate-500 tabular-nums">
            {summaryStats.tsIssues} missing timestamp(s)
          </p>
        </div>
      </div>

      {/* Dual Recharts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Composed Trend Chart (Dropouts + Anomalies + Integrity Curve) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-[#faf8ff] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-[#131b2e]">
              Dropout &amp; Anomaly Trend ({grouping === 'sequence' ? 'Input Sequence' : grouping})
            </h3>
            <span className="text-[11px] text-slate-500">
              {metricMode === 'counts' ? 'Row count + Integrity %' : 'Percentage of bucket rows'}
            </span>
          </div>

          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={trendBuckets}
                margin={{ top: 10, right: 16, left: -10, bottom: 8 }}
                onClick={(state) => {
                  const idx = Number(state?.activeTooltipIndex);
                  const bucket = Number.isInteger(idx) ? trendBuckets[idx] : undefined;
                  if (bucket && bucket.rowIds.length > 0) {
                    onInspectRows(
                      bucket.flaggedRowIds.length > 0 ? bucket.flaggedRowIds : bucket.rowIds,
                      `${bucket.label} — Data Integrity`
                    );
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#3f493f' }}
                  interval={0}
                  angle={trendBuckets.length > 5 ? -15 : 0}
                  textAnchor={trendBuckets.length > 5 ? 'end' : 'middle'}
                  height={44}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#3f493f' }}
                  domain={metricMode === 'rates' ? [0, 100] : [0, 'auto']}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#15803d' }}
                  unit="%"
                />
                <Tooltip content={<IntegrityTooltip metricMode={metricMode} />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine yAxisId="right" y={80} stroke="#16a34a" strokeDasharray="4 4" />
                <Bar
                  yAxisId="left"
                  dataKey={metricMode === 'counts' ? 'dropoutCount' : 'dropoutRate'}
                  name={metricMode === 'counts' ? 'Sensor Dropouts' : 'Dropout Rate (%)'}
                  fill="#eab308"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  yAxisId="left"
                  dataKey={metricMode === 'counts' ? 'anomalyCount' : 'anomalyRate'}
                  name={metricMode === 'counts' ? 'Anomaly Spikes' : 'Anomaly Rate (%)'}
                  fill="#ba1a1a"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="integrityRate"
                  name="Integrity (%)"
                  stroke="#15803d"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#15803d', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 5 Cols: Station Integrity Breakdown Area/Bar Chart */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-[#faf8ff] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-[#131b2e]">
              Station Health Distribution
            </h3>
            <span className="text-[11px] text-slate-500">Valid vs. Faulty rows</span>
          </div>

          <div className="h-[135px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stationBreakdown}
                margin={{ top: 6, right: 10, left: -18, bottom: 4 }}
                onClick={(state) => {
                  const idx = Number(state?.activeTooltipIndex);
                  const bucket = Number.isInteger(idx) ? stationBreakdown[idx] : undefined;
                  if (bucket && bucket.rowIds.length > 0) {
                    onInspectRows(
                      bucket.flaggedRowIds.length > 0 ? bucket.flaggedRowIds : bucket.rowIds,
                      `${bucket.label} — Integrity Rows`
                    );
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#3f493f' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#3f493f' }} />
                <Tooltip content={<IntegrityTooltip metricMode="counts" />} />
                <Bar dataKey="validCount" name="Valid" stackId="a" fill="#15803d" />
                <Bar dataKey="dropoutCount" name="Dropouts" stackId="a" fill="#eab308" />
                <Bar
                  dataKey="anomalyCount"
                  name="Anomalies"
                  stackId="a"
                  fill="#ba1a1a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative Integrity Envelope AreaChart */}
          <div className="pt-2 border-t border-slate-200/70">
            <p className="text-[11px] font-semibold text-[#3f493f] mb-1">
              Integrity Rate Envelope Across Intervals (%)
            </p>
            <div className="h-[105px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendBuckets} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vayuIntegrityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" hide />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#3f493f' }} />
                  <Tooltip content={<IntegrityTooltip metricMode="rates" />} />
                  <Area
                    type="monotone"
                    dataKey="integrityRate"
                    name="Integrity %"
                    stroke="#00652c"
                    strokeWidth={2}
                    fill="url(#vayuIntegrityGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
