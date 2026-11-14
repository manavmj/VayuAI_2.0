import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { NormalizationResult, NormalizedReading } from '../types/vayu.ts';
import { getNaqiStyle } from '../utils/naqi.ts';

interface DataQualityChartsProps {
  normalization: NormalizationResult;
  onInspectRows: (rows: number[], title?: string) => void;
}

const WHO_THRESHOLDS: Record<string, { limit: number; unit: string }> = {
  'PM2.5': { limit: 15, unit: 'µg/m³' },
  PM10: { limit: 45, unit: 'µg/m³' },
  NO2: { limit: 25, unit: 'µg/m³' },
  SO2: { limit: 40, unit: 'µg/m³' },
  CO: { limit: 4, unit: 'mg/m³' },
  O3: { limit: 100, unit: 'µg/m³' },
};

export const DataQualityCharts: React.FC<DataQualityChartsProps> = ({
  normalization,
  onInspectRows,
}) => {
  const [chartZoom, setChartZoom] = useState<number>(1);
  const [hoveredReading, setHoveredReading] = useState<NormalizedReading | null>(null);

  const readings = normalization.readings;
  const maxNaqiAxis = useMemo(() => {
    const vals = readings
      .map((r) => r.naqiSubIndex ?? 0)
      .filter((v) => v > 0);
    return Math.max(300, ...vals, 100);
  }, [readings]);

  // 1. Hygiene Donut Breakdown
  const hygieneSlices = useMemo(() => {
    const converted = readings.filter(
      (r) =>
        r.status === 'valid' &&
        r.rawUnit &&
        r.normalizedUnit &&
        r.rawUnit.toLowerCase() !== r.normalizedUnit.toLowerCase()
    ).length;
    const pureValid = Math.max(0, normalization.validCount - converted);
    const gaps = normalization.gapCount;
    const anomalies = normalization.anomalyCount;
    const total = Math.max(1, normalization.totalSourceRows);

    return [
      { label: 'Direct Valid', count: pureValid, pct: (pureValid / total) * 100, color: '#15803d' },
      { label: 'Unit Converted', count: converted, pct: (converted / total) * 100, color: '#16a34a' },
      { label: 'Missing / Gaps', count: gaps, pct: (gaps / total) * 100, color: '#eab308' },
      { label: 'Quarantined Outliers', count: anomalies, pct: (anomalies / total) * 100, color: '#ba1a1a' },
    ];
  }, [readings, normalization]);

  // 2. Pollutant WHO Exceedance Ratios (strictly from observed valid readings)
  const pollutantRatios = useMemo(() => {
    const byPollutant = new Map<string, { peak: number; unit: string; rows: number[] }>();
    for (const r of readings) {
      if (r.status !== 'valid' || r.normalizedValue === null) continue;
      const key = r.pollutant.toUpperCase().replace(/\s+/g, '');
      const existing = byPollutant.get(key);
      if (!existing || r.normalizedValue > existing.peak) {
        byPollutant.set(key, {
          peak: r.normalizedValue,
          unit: r.normalizedUnit,
          rows: existing ? [...existing.rows, r.rowIndex] : [r.rowIndex],
        });
      } else {
        existing.rows.push(r.rowIndex);
      }
    }

    return Array.from(byPollutant.entries())
      .filter(([key]) => Boolean(WHO_THRESHOLDS[key]))
      .map(([key, data]) => {
        const thresh = WHO_THRESHOLDS[key];
        const ratio = Number((data.peak / thresh.limit).toFixed(1));
        return {
          pollutant: key,
          peak: data.peak,
          limit: thresh.limit,
          unit: thresh.unit,
          ratio,
          rows: data.rows,
        };
      });
  }, [readings]);

  // 3. Station Completeness vs Peak NAQI scatter points
  const scatterPoints = useMemo(() => {
    return normalization.stationSummaries.map((st) => {
      const completeness =
        st.readingCount > 0 ? Math.round((st.validCount / st.readingCount) * 100) : 0;
      return {
        station: st.station,
        completeness,
        peakNaqi: st.peakNaqi ?? 0,
        category: st.peakCategory,
        citedRows: st.citedRows,
      };
    });
  }, [normalization.stationSummaries]);

  // Time-Series SVG geometry
  const baseWidth = 760;
  const svgWidth = Math.round(baseWidth * chartZoom);
  const svgHeight = 230;
  const padL = 44;
  const padR = 24;
  const padT = 20;
  const padB = 34;
  const plotW = svgWidth - padL - padR;
  const plotH = svgHeight - padT - padB;

  const getX = (idx: number) =>
    readings.length <= 1 ? padL + plotW / 2 : padL + (idx / (readings.length - 1)) * plotW;
  const getY = (val: number) => padT + plotH - Math.min(1, Math.max(0, val / maxNaqiAxis)) * plotH;

  const validLinePoints = readings
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === 'valid' && r.naqiSubIndex !== null)
    .map(({ r, i }) => `${getX(i).toFixed(1)},${getY(r.naqiSubIndex || 0).toFixed(1)}`)
    .join(' ');

  // Donut stroke-dasharray geometry
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  return (
    <div className="space-y-6">
      {/* Row 1: Zoomable Time-Series Anomaly Overlay + Hygiene Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Time-Series NAQI & Anomaly Overlay */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-[#131b2e]">
                01. Row-Sequence CPCB NAQI Trend &amp; Anomaly Overlay
              </h3>
              <p className="text-xs text-slate-500">
                Verified readings plotted against flagged spikes (red) and sensor dropouts (amber bands). Click any marker to trace.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[#faf8ff] p-1">
              <button
                type="button"
                aria-label="Zoom out trend chart"
                onClick={() => setChartZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                disabled={chartZoom <= 1}
                className="rounded p-1 text-slate-600 hover:bg-white disabled:opacity-40"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-mono text-xs font-semibold text-[#131b2e] tabular-nums">
                {chartZoom}x
              </span>
              <button
                type="button"
                aria-label="Zoom in trend chart"
                onClick={() => setChartZoom((z) => Math.min(2.5, Number((z + 0.5).toFixed(1))))}
                disabled={chartZoom >= 2.5}
                className="rounded p-1 text-slate-600 hover:bg-white disabled:opacity-40"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              {chartZoom > 1 && (
                <button
                  type="button"
                  aria-label="Reset chart zoom"
                  onClick={() => setChartZoom(1)}
                  className="rounded p-1 text-slate-600 hover:bg-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-[#faf8ff] p-2">
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label="Time-series NAQI trend and anomaly overlay chart"
              className="block"
            >
              {/* Horizontal reference gridlines */}
              {[0, 100, 200, 300, 400].filter((v) => v <= maxNaqiAxis).map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgWidth - padR}
                      y2={y}
                      stroke="#cbd5e1"
                      strokeDasharray={tick === 100 ? '4 3' : '2 4'}
                      strokeWidth={tick === 100 ? 1.2 : 0.8}
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Shaded bands for missing/gap rows */}
              {readings.map((r, i) => {
                if (r.status !== 'missing') return null;
                const x = getX(i);
                const bandW = Math.max(14, plotW / Math.max(1, readings.length));
                return (
                  <rect
                    key={`gap-${r.rowIndex}`}
                    x={x - bandW / 2}
                    y={padT}
                    width={bandW}
                    height={plotH}
                    fill="#fef9c3"
                    opacity={0.75}
                    className="cursor-pointer"
                    onClick={() => onInspectRows([r.rowIndex], `Gap at Row #${r.rowIndex}`)}
                  />
                );
              })}

              {/* Valid NAQI polyline */}
              {validLinePoints && (
                <polyline
                  fill="none"
                  stroke="#15803d"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={validLinePoints}
                />
              )}

              {/* Interactive points */}
              {readings.map((r, i) => {
                const cx = getX(i);
                const cy =
                  r.status === 'missing'
                    ? padT + plotH - 8
                    : getY(r.naqiSubIndex ?? (r.status === 'anomaly' ? maxNaqiAxis * 0.92 : 0));
                const fill =
                  r.status === 'valid'
                    ? '#15803d'
                    : r.status === 'anomaly'
                      ? '#ba1a1a'
                      : '#d97706';
                return (
                  <g
                    key={`pt-${r.rowIndex}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredReading(r)}
                    onMouseLeave={() => setHoveredReading(null)}
                    onClick={() => onInspectRows([r.rowIndex], `Row #${r.rowIndex} (${r.station})`)}
                  >
                    <circle cx={cx} cy={cy} r={r.status === 'valid' ? 4.5 : 5.5} fill={fill} stroke="#ffffff" strokeWidth="1.5" />
                    <text
                      x={cx}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[9px]"
                    >
                      #{r.rowIndex}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#15803d]" /> Valid NAQI
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ba1a1a]" /> Quarantined Anomaly
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#eab308]" /> Missing Gap
              </span>
            </div>
            {hoveredReading && (
              <span className="font-mono text-xs text-[#131b2e]">
                Row #{hoveredReading.rowIndex} · {hoveredReading.station} ·{' '}
                {hoveredReading.pollutant}{' '}
                {hoveredReading.normalizedValue ?? 'Null'} {hoveredReading.normalizedUnit}
              </span>
            )}
          </div>
        </div>

        {/* Chart 2: Data Hygiene Composition Donut */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              02. Data Hygiene Composition
            </h3>
            <p className="text-xs text-slate-500">
              Exact breakdown of {normalization.totalSourceRows} source rows audited
            </p>
          </div>

          <div className="flex items-center justify-center py-2">
            <svg width="144" height="144" viewBox="0 0 144 144" role="img" aria-label="Data hygiene breakdown donut chart">
              <circle cx="72" cy="72" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
              {hygieneSlices.map((slice) => {
                if (slice.count === 0) return null;
                const dashLen = (slice.pct / 100) * circumference;
                const offset = -runningOffset;
                runningOffset += dashLen;
                return (
                  <circle
                    key={slice.label}
                    cx="72"
                    cy="72"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="18"
                    strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 72 72)"
                  />
                );
              })}
              <text x="72" y="69" textAnchor="middle" className="fill-[#131b2e] font-display text-xl font-bold">
                {Math.round((normalization.validCount / Math.max(1, normalization.totalSourceRows)) * 100)}%
              </text>
              <text x="72" y="86" textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
                Verified
              </text>
            </svg>
          </div>

          <div className="space-y-2">
            {hygieneSlices.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-[#3f493f]">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-mono font-semibold text-[#131b2e] tabular-nums">
                  {s.count} ({Math.round(s.pct)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Station Peak NAQI Bars + WHO Exceedance Multiples + Reliability Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 3: Station Peak NAQI Bar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              03. Station Peak CPCB NAQI
            </h3>
            <p className="text-xs text-slate-500">Observed station maximums (max scale 500)</p>
          </div>
          <div className="space-y-3">
            {normalization.stationSummaries.map((st) => {
              const val = st.peakNaqi ?? 0;
              const pct = Math.min(100, Math.round((val / 500) * 100));
              const style = getNaqiStyle(st.peakCategory);
              return (
                <button
                  key={st.station}
                  type="button"
                  onClick={() => onInspectRows(st.citedRows, `${st.station} Readings`)}
                  className="w-full text-left space-y-1 group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#131b2e] group-hover:text-[#00652c] truncate pr-2">
                      {st.station}
                    </span>
                    <span className="font-mono font-semibold text-[#131b2e] tabular-nums shrink-0">
                      {st.peakNaqi ?? 'N/A'} · {st.peakCategory}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        val > 300
                          ? 'bg-[#ba1a1a]'
                          : val > 200
                            ? 'bg-[#ea580c]'
                            : val > 100
                              ? 'bg-[#eab308]'
                              : 'bg-[#15803d]'
                      }`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                  <span className={`sr-only`}>{style.range}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart 4: WHO 2021 Guideline Exceedance Ratios */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              04. WHO 2021 Guideline Exceedance
            </h3>
            <p className="text-xs text-slate-500">Peak observed pollutant vs. WHO safe threshold</p>
          </div>
          {pollutantRatios.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No WHO-benchmarked pollutant concentrations in valid rows.
            </p>
          ) : (
            <div className="space-y-3">
              {pollutantRatios.map((item) => {
                const barPct = Math.min(100, Math.round((item.ratio / Math.max(10, ...pollutantRatios.map((p) => p.ratio))) * 100));
                const exceeded = item.ratio > 1;
                return (
                  <button
                    key={item.pollutant}
                    type="button"
                    onClick={() => onInspectRows(item.rows, `${item.pollutant} Observations`)}
                    className="w-full text-left space-y-1 group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-[#131b2e]">
                        {item.pollutant}{' '}
                        <span className="font-normal text-slate-500">
                          ({item.peak} vs {item.limit} {item.unit})
                        </span>
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          exceeded ? 'text-[#ba1a1a]' : 'text-[#15803d]'
                        }`}
                      >
                        {item.ratio}× WHO
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${exceeded ? 'bg-[#ba1a1a]' : 'bg-[#16a34a]'}`}
                        style={{ width: `${Math.max(5, barPct)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart 5: Station Completeness vs Peak NAQI Scatter Matrix */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              05. Reliability vs. Severity Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Valid completeness % (X) vs Peak NAQI (Y) per station
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#faf8ff] p-2">
            <svg viewBox="0 0 280 175" className="w-full h-auto" role="img" aria-label="Station reliability versus NAQI severity scatter chart">
              <line x1="36" y1="14" x2="36" y2="144" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="36" y1="144" x2="266" y2="144" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="36" y1="79" x2="266" y2="79" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="151" y1="14" x2="151" y2="144" stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x="151" y="164" textAnchor="middle" className="fill-slate-500 text-[9px] font-medium">
                Valid Data Completeness (0% → 100%)
              </text>
              <text x="12" y="80" textAnchor="middle" transform="rotate(-90 12 80)" className="fill-slate-500 text-[9px] font-medium">
                NAQI
              </text>

              {scatterPoints.map((pt) => {
                const cx = 36 + (pt.completeness / 100) * 224;
                const cy = 144 - Math.min(1, pt.peakNaqi / 500) * 124;
                const fill = pt.completeness < 70 ? '#d97706' : pt.peakNaqi > 200 ? '#ba1a1a' : '#15803d';
                return (
                  <g
                    key={pt.station}
                    className="cursor-pointer"
                    onClick={() => onInspectRows(pt.citedRows, `${pt.station} Reliability`)}
                  >
                    <circle cx={cx} cy={cy} r="6" fill={fill} stroke="#ffffff" strokeWidth="1.5" />
                    <text
                      x={Math.min(220, cx + 8)}
                      y={cy + 3}
                      className="fill-[#131b2e] text-[9px] font-semibold"
                    >
                      {pt.station.split(' ').slice(0, 2).join(' ')}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
