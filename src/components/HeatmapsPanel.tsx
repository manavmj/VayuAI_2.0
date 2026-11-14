import React, { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import type { NormalizationResult, NormalizedReading } from '../types/vayu.ts';

interface HeatmapsPanelProps {
  normalization: NormalizationResult;
  onInspectRows: (rows: number[], title?: string) => void;
}

function getHeatCellClasses(reading: NormalizedReading | undefined): string {
  if (!reading) return 'bg-slate-50 text-slate-400 border-slate-200/70';
  if (reading.status === 'missing') return 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]';
  if (reading.status === 'anomaly') return 'bg-[#ffdad6] text-[#93000a] border-[#f87171]';

  const naqi = reading.naqiSubIndex ?? 0;
  if (naqi <= 50) return 'bg-[#dcfce7] text-[#14532d] border-[#86efac]';
  if (naqi <= 100) return 'bg-[#ecfccb] text-[#365314] border-[#bef264]';
  if (naqi <= 200) return 'bg-[#fef08a] text-[#854d0e] border-[#facc15]';
  if (naqi <= 300) return 'bg-[#fed7aa] text-[#9a3412] border-[#fb923c]';
  if (naqi <= 400) return 'bg-[#fecaca] text-[#991b1b] border-[#f87171]';
  return 'bg-[#fca5a5] text-[#7f1d1d] border-[#dc2626]';
}

export const HeatmapsPanel: React.FC<HeatmapsPanelProps> = React.memo(({
  normalization,
  onInspectRows,
}) => {
  const { stations, pollutants, matrixMap, rowBatches, hygieneGrid } = useMemo(() => {
    const stationSet = new Set<string>();
    const pollutantSet = new Set<string>();
    const cellMap = new Map<string, NormalizedReading[]>();

    for (const r of normalization.readings) {
      stationSet.add(r.station);
      const pKey = r.pollutant.toUpperCase().trim();
      pollutantSet.add(pKey);
      const key = `${r.station}::${pKey}`;
      const list = cellMap.get(key) ?? [];
      list.push(r);
      cellMap.set(key, list);
    }

    const stList = Array.from(stationSet);
    const pList = Array.from(pollutantSet);

    // Row-sequence bucket heatmap (up to 6 intervals per station)
    const maxRow = normalization.totalSourceRows;
    const bucketCount = Math.min(6, Math.max(2, Math.ceil(maxRow / 3)));
    const bucketSize = Math.max(1, Math.ceil(maxRow / bucketCount));
    const batches: Array<{ label: string; minRow: number; maxRow: number }> = [];
    for (let start = 1; start <= maxRow; start += bucketSize) {
      const end = Math.min(maxRow, start + bucketSize - 1);
      batches.push({
        label: start === end ? `#${start}` : `#${start}–#${end}`,
        minRow: start,
        maxRow: end,
      });
    }

    const hGrid = new Map<string, NormalizedReading[]>();
    for (const r of normalization.readings) {
      const bIdx = batches.findIndex((b) => r.rowIndex >= b.minRow && r.rowIndex <= b.maxRow);
      if (bIdx >= 0) {
        const key = `${r.station}::${bIdx}`;
        const arr = hGrid.get(key) ?? [];
        arr.push(r);
        hGrid.set(key, arr);
      }
    }

    return {
      stations: stList,
      pollutants: pList,
      matrixMap: cellMap,
      rowBatches: batches,
      hygieneGrid: hGrid,
    };
  }, [normalization]);

  return (
    <section
      aria-labelledby="heatmaps-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
            <Grid3X3 className="h-4 w-4" aria-hidden="true" />
            <span>Spatial &amp; Temporal Heatmaps</span>
          </div>
          <h2
            id="heatmaps-heading"
            className="mt-1 font-display text-xl font-semibold text-[#131b2e]"
          >
            Station × Pollutant Severity &amp; Sensor Hygiene Heatmaps
          </h2>
          <p className="text-xs text-[#3f493f]">
            Color-coded matrices computed exclusively from verified rows. Click any heatmap cell to
            inspect the underlying raw input records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#3f493f]">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#dcfce7] border border-[#86efac]" /> Good/Sat
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#fef08a] border border-[#facc15]" /> Moderate
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#fed7aa] border border-[#fb923c]" /> Poor
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#fca5a5] border border-[#dc2626]" /> Very Poor/Severe
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#fef9c3] border border-[#fde047]" /> Gap
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-[#ffdad6] border border-[#f87171]" /> Anomaly
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Heatmap 1: Station x Pollutant Severity */}
        <div className="xl:col-span-7 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-[#131b2e]">
            Heatmap 01 · Station × Pollutant Peak Concentration &amp; NAQI
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-[#faf8ff] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-[#131b2e]">
                    Station / Zone
                  </th>
                  {pollutants.map((p) => (
                    <th key={p} className="px-3 py-2.5 text-center font-mono font-semibold text-[#131b2e]">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stations.map((st) => (
                  <tr key={st}>
                    <td className="px-3 py-2.5 font-semibold text-[#131b2e] whitespace-nowrap">
                      {st}
                    </td>
                    {pollutants.map((p) => {
                      const list = matrixMap.get(`${st}::${p}`) ?? [];
                      // Pick worst/peak valid reading, or anomaly/gap if no valid
                      const sorted = [...list].sort(
                        (a, b) => (b.naqiSubIndex ?? -1) - (a.naqiSubIndex ?? -1)
                      );
                      const rep = sorted[0];
                      const cellClass = getHeatCellClasses(rep);

                      return (
                        <td key={p} className="p-1.5 text-center">
                          {rep ? (
                            <button
                              type="button"
                              onClick={() =>
                                onInspectRows(
                                  list.map((x) => x.rowIndex),
                                  `${st} · ${p} Heatmap Cell`
                                )
                              }
                              className={`w-full rounded-lg border px-2 py-2 font-mono text-[11px] font-semibold tabular-nums transition-transform hover:scale-[1.02] ${cellClass}`}
                            >
                              {rep.status === 'valid' ? (
                                <>
                                  <div>
                                    {rep.normalizedValue} {rep.normalizedUnit}
                                  </div>
                                  <div className="text-[10px] opacity-80">
                                    NAQI {rep.naqiSubIndex ?? '—'}
                                  </div>
                                </>
                              ) : rep.status === 'missing' ? (
                                <div>GAP</div>
                              ) : (
                                <div>SPIKE</div>
                              )}
                            </button>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 px-2 py-2.5 font-mono text-[10px] text-slate-400">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Heatmap 2: Station x Row-Interval Hygiene Reliability */}
        <div className="xl:col-span-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-[#131b2e]">
            Heatmap 02 · Station × Sequence Reliability Matrix
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-[#faf8ff] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-[#131b2e]">Station</th>
                  {rowBatches.map((b) => (
                    <th key={b.label} className="px-2 py-2.5 text-center font-mono text-[11px] font-semibold text-[#3f493f]">
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stations.map((st) => (
                  <tr key={st}>
                    <td className="px-3 py-2.5 font-medium text-[#131b2e] whitespace-nowrap max-w-[140px] truncate">
                      {st}
                    </td>
                    {rowBatches.map((b, bIdx) => {
                      const items = hygieneGrid.get(`${st}::${bIdx}`) ?? [];
                      const hasAnomaly = items.some((r) => r.status === 'anomaly');
                      const hasGap = items.some((r) => r.status === 'missing');
                      const validCount = items.filter((r) => r.status === 'valid').length;

                      let cls = 'bg-slate-50 text-slate-400 border-slate-200/70';
                      let label = '—';
                      if (items.length > 0) {
                        if (hasAnomaly) {
                          cls = 'bg-[#ffdad6] text-[#93000a] border-[#f87171]';
                          label = `${items.length} !`;
                        } else if (hasGap) {
                          cls = 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]';
                          label = `${validCount}/${items.length}`;
                        } else {
                          cls = 'bg-[#dcfce7] text-[#14532d] border-[#86efac]';
                          label = `${validCount}/${items.length}`;
                        }
                      }

                      return (
                        <td key={b.label} className="p-1.5 text-center">
                          {items.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onInspectRows(
                                  items.map((x) => x.rowIndex),
                                  `${st} (${b.label})`
                                )
                              }
                              className={`w-full rounded-lg border px-1.5 py-2 font-mono text-[11px] font-semibold tabular-nums ${cls}`}
                            >
                              {label}
                            </button>
                          ) : (
                            <div className={`rounded-lg border px-1.5 py-2 font-mono text-[10px] ${cls}`}>
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
});
