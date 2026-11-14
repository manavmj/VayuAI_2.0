import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';

type PollutantKey = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3';
type UnitKey = 'ug/m3' | 'mg/m3' | 'ppm' | 'ppb';

interface PollutantSpec {
  label: string;
  molarMass: number | null; // g/mol (null for particulate matter)
  whoLimit: number;
  whoUnit: 'ug/m3' | 'mg/m3';
  cpcbBreakpoints: Array<{ cLow: number; cHigh: number; iLow: number; iHigh: number; cat: string }>;
}

const POLLUTANTS: Record<PollutantKey, PollutantSpec> = {
  'PM2.5': {
    label: 'PM2.5 (Fine Particulate)',
    molarMass: null,
    whoLimit: 15,
    whoUnit: 'ug/m3',
    cpcbBreakpoints: [
      { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50, cat: 'Good' },
      { cLow: 30, cHigh: 60, iLow: 51, iHigh: 100, cat: 'Satisfactory' },
      { cLow: 60, cHigh: 90, iLow: 101, iHigh: 200, cat: 'Moderate' },
      { cLow: 90, cHigh: 120, iLow: 201, iHigh: 300, cat: 'Poor' },
      { cLow: 120, cHigh: 250, iLow: 301, iHigh: 400, cat: 'Very Poor' },
      { cLow: 250, cHigh: 500, iLow: 401, iHigh: 500, cat: 'Severe' },
    ],
  },
  PM10: {
    label: 'PM10 (Coarse Dust)',
    molarMass: null,
    whoLimit: 45,
    whoUnit: 'ug/m3',
    cpcbBreakpoints: [
      { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50, cat: 'Good' },
      { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100, cat: 'Satisfactory' },
      { cLow: 100, cHigh: 250, iLow: 101, iHigh: 200, cat: 'Moderate' },
      { cLow: 250, cHigh: 350, iLow: 201, iHigh: 300, cat: 'Poor' },
      { cLow: 350, cHigh: 430, iLow: 301, iHigh: 400, cat: 'Very Poor' },
      { cLow: 430, cHigh: 600, iLow: 401, iHigh: 500, cat: 'Severe' },
    ],
  },
  NO2: {
    label: 'NO2 (Nitrogen Dioxide)',
    molarMass: 46.01,
    whoLimit: 25,
    whoUnit: 'ug/m3',
    cpcbBreakpoints: [
      { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50, cat: 'Good' },
      { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100, cat: 'Satisfactory' },
      { cLow: 80, cHigh: 180, iLow: 101, iHigh: 200, cat: 'Moderate' },
      { cLow: 180, cHigh: 280, iLow: 201, iHigh: 300, cat: 'Poor' },
      { cLow: 280, cHigh: 400, iLow: 301, iHigh: 400, cat: 'Very Poor' },
      { cLow: 400, cHigh: 600, iLow: 401, iHigh: 500, cat: 'Severe' },
    ],
  },
  SO2: {
    label: 'SO2 (Sulfur Dioxide)',
    molarMass: 64.07,
    whoLimit: 40,
    whoUnit: 'ug/m3',
    cpcbBreakpoints: [
      { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50, cat: 'Good' },
      { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100, cat: 'Satisfactory' },
      { cLow: 80, cHigh: 380, iLow: 101, iHigh: 200, cat: 'Moderate' },
      { cLow: 380, cHigh: 800, iLow: 201, iHigh: 300, cat: 'Poor' },
      { cLow: 800, cHigh: 1600, iLow: 301, iHigh: 400, cat: 'Very Poor' },
      { cLow: 1600, cHigh: 2400, iLow: 401, iHigh: 500, cat: 'Severe' },
    ],
  },
  CO: {
    label: 'CO (Carbon Monoxide)',
    molarMass: 28.01,
    whoLimit: 4,
    whoUnit: 'mg/m3',
    cpcbBreakpoints: [
      { cLow: 0, cHigh: 1, iLow: 0, iHigh: 50, cat: 'Good' },
      { cLow: 1, cHigh: 2, iLow: 51, iHigh: 100, cat: 'Satisfactory' },
      { cLow: 2, cHigh: 10, iLow: 101, iHigh: 200, cat: 'Moderate' },
      { cLow: 10, cHigh: 17, iLow: 201, iHigh: 300, cat: 'Poor' },
      { cLow: 17, cHigh: 34, iLow: 301, iHigh: 400, cat: 'Very Poor' },
      { cLow: 34, cHigh: 50, iLow: 401, iHigh: 500, cat: 'Severe' },
    ],
  },
  O3: {
    label: 'O3 (Ground Ozone)',
    molarMass: 48.0,
    whoLimit: 100,
    whoUnit: 'ug/m3',
    cpcbBreakpoints: [
      { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50, cat: 'Good' },
      { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100, cat: 'Satisfactory' },
      { cLow: 100, cHigh: 168, iLow: 101, iHigh: 200, cat: 'Moderate' },
      { cLow: 168, cHigh: 208, iLow: 201, iHigh: 300, cat: 'Poor' },
      { cLow: 208, cHigh: 748, iLow: 301, iHigh: 400, cat: 'Very Poor' },
      { cLow: 748, cHigh: 1000, iLow: 401, iHigh: 500, cat: 'Severe' },
    ],
  },
};

const UNIT_LABELS: Record<UnitKey, string> = {
  'ug/m3': 'µg/m³',
  'mg/m3': 'mg/m³',
  ppm: 'ppm',
  ppb: 'ppb',
};

function convertToUgM3(
  value: number,
  fromUnit: UnitKey,
  molarMass: number | null,
  tempC: number
): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  if (fromUnit === 'ug/m3') return value;
  if (fromUnit === 'mg/m3') return value * 1000;
  if (!molarMass) return null; // PM2.5/PM10 cannot convert to ppm/ppb
  const molarVolume = 24.45 * ((tempC + 273.15) / 298.15);
  if (fromUnit === 'ppm') return (value * molarMass * 1000) / molarVolume;
  if (fromUnit === 'ppb') return (value * molarMass) / molarVolume;
  return null;
}

function convertFromUgM3(
  ugM3: number,
  toUnit: UnitKey,
  molarMass: number | null,
  tempC: number
): number | null {
  if (toUnit === 'ug/m3') return ugM3;
  if (toUnit === 'mg/m3') return ugM3 / 1000;
  if (!molarMass) return null;
  const molarVolume = 24.45 * ((tempC + 273.15) / 298.15);
  if (toUnit === 'ppm') return (ugM3 * molarVolume) / (molarMass * 1000);
  if (toUnit === 'ppb') return (ugM3 * molarVolume) / molarMass;
  return null;
}

interface UnitConverterToolProps {
  language?: 'en' | 'hi';
}

export const UnitConverterTool: React.FC<UnitConverterToolProps> = ({ language = 'en' }) => {
  const isHi = language === 'hi';
  const [pollutant, setPollutant] = useState<PollutantKey>('NO2');
  const [inputVal, setInputVal] = useState<string>('48');
  const [fromUnit, setFromUnit] = useState<UnitKey>('ppb');
  const [toUnit, setToUnit] = useState<UnitKey>('ug/m3');
  const [tempC, setTempC] = useState<number>(25);

  const spec = POLLUTANTS[pollutant];
  const isParticulate = spec.molarMass === null;

  const availableUnits: UnitKey[] = isParticulate
    ? ['ug/m3', 'mg/m3']
    : ['ug/m3', 'mg/m3', 'ppm', 'ppb'];

  const handlePollutantChange = (next: PollutantKey) => {
    setPollutant(next);
    const nextIsPm = POLLUTANTS[next].molarMass === null;
    if (nextIsPm) {
      if (fromUnit === 'ppm' || fromUnit === 'ppb') setFromUnit('ug/m3');
      if (toUnit === 'ppm' || toUnit === 'ppb') setToUnit('mg/m3');
    } else if (next === 'CO') {
      setFromUnit('ppm');
      setToUnit('mg/m3');
    }
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const calculation = useMemo(() => {
    const num = Number(inputVal);
    if (!inputVal.trim() || !Number.isFinite(num) || num < 0) {
      return null;
    }

    const ugM3 = convertToUgM3(num, fromUnit, spec.molarMass, tempC);
    if (ugM3 === null) return null;

    const converted = convertFromUgM3(ugM3, toUnit, spec.molarMass, tempC);
    if (converted === null) return null;

    // CPCB sub-index calculation
    const cpcbVal = spec.whoUnit === 'mg/m3' ? ugM3 / 1000 : ugM3;
    let naqiSub: number | null = null;
    let naqiCat = 'Severe';

    for (const bp of spec.cpcbBreakpoints) {
      if (cpcbVal <= bp.cHigh) {
        const ratio = (cpcbVal - bp.cLow) / Math.max(0.0001, bp.cHigh - bp.cLow);
        naqiSub = Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));
        naqiCat = bp.cat;
        break;
      }
    }
    if (naqiSub === null) {
      naqiSub = 500;
      naqiCat = 'Severe';
    }

    const whoExceeded = cpcbVal > spec.whoLimit;
    const whoRatio = Number((cpcbVal / spec.whoLimit).toFixed(2));

    return {
      converted,
      cpcbStandardValue: cpcbVal,
      cpcbStandardUnit: spec.whoUnit,
      naqiSub,
      naqiCat,
      whoExceeded,
      whoRatio,
    };
  }, [inputVal, fromUnit, toUnit, spec, tempC]);

  return (
    <section
      aria-labelledby="unit-converter-heading"
      className="rounded-2xl border border-[#16a34a]/20 bg-white p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            <span>{isHi ? 'प्रदूषक इकाई परिवर्तक' : 'Air Pollutant Unit Converter'}</span>
          </div>
          <h2
            id="unit-converter-heading"
            className="mt-1 font-display text-xl font-semibold text-[#131b2e]"
          >
            {isHi
              ? 'µg/m³, mg/m³, ppm और ppb को CPCB NAQI में बदलें'
              : 'Convert µg/m³, mg/m³, ppm & ppb with Live CPCB / WHO Check'}
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="converter-temp" className="font-medium text-[#3f493f]">
            Ambient Temp (°C):
          </label>
          <input
            id="converter-temp"
            type="number"
            min={-10}
            max={55}
            value={tempC}
            onChange={(e) => setTempC(Number(e.target.value) || 25)}
            className="w-16 rounded-lg border border-slate-200 bg-[#faf8ff] px-2 py-1 font-mono text-xs text-[#131b2e] tabular-nums focus:border-[#16a34a] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3">
          <label
            htmlFor="conv-pollutant"
            className="block text-xs font-semibold text-[#3f493f] mb-1.5"
          >
            Pollutant
          </label>
          <select
            id="conv-pollutant"
            value={pollutant}
            onChange={(e) => handlePollutantChange(e.target.value as PollutantKey)}
            className="w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 text-sm font-medium text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
          >
            {(Object.keys(POLLUTANTS) as PollutantKey[]).map((key) => (
              <option key={key} value={key}>
                {POLLUTANTS[key].label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="conv-value" className="block text-xs font-semibold text-[#3f493f] mb-1.5">
            Concentration Value
          </label>
          <input
            id="conv-value"
            type="number"
            min="0"
            step="any"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 font-mono text-sm text-[#131b2e] tabular-nums focus:border-[#16a34a] focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="conv-from" className="block text-xs font-semibold text-[#3f493f] mb-1.5">
            From Unit
          </label>
          <select
            id="conv-from"
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value as UnitKey)}
            className="w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 font-mono text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
          >
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap conversion units"
            className="rounded-lg border border-slate-200 bg-[#faf8ff] p-2.5 text-[#15803d] hover:bg-[#f0fdf4]"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="conv-to" className="block text-xs font-semibold text-[#3f493f] mb-1.5">
            Target Unit
          </label>
          <select
            id="conv-to"
            value={toUnit}
            onChange={(e) => setToUnit(e.target.value as UnitKey)}
            className="w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 font-mono text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
          >
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {calculation ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-xl border border-[#16a34a]/20 bg-[#f0fdf4] p-4">
            <p className="text-xs font-medium text-[#14532d]">Converted Value</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#00652c] tabular-nums">
              {calculation.converted < 0.01
                ? calculation.converted.toFixed(5)
                : calculation.converted < 10
                  ? calculation.converted.toFixed(3)
                  : calculation.converted.toFixed(1)}{' '}
              <span className="text-sm font-semibold">{UNIT_LABELS[toUnit]}</span>
            </p>
            <p className="mt-1 text-[11px] text-[#3f493f] font-mono tabular-nums">
              CPCB Std: {calculation.cpcbStandardValue.toFixed(2)}{' '}
              {UNIT_LABELS[calculation.cpcbStandardUnit]}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#faf8ff] p-4">
            <p className="text-xs font-medium text-slate-500">CPCB NAQI Sub-Index</p>
            <p className="mt-1 font-display text-2xl font-bold text-[#131b2e] tabular-nums">
              {calculation.naqiSub}{' '}
              <span className="text-sm font-semibold text-[#15803d]">({calculation.naqiCat})</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {spec.molarMass
                ? `Molar mass ${spec.molarMass} g/mol at ${tempC}°C`
                : 'Gravimetric particulate mass concentration'}
            </p>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              calculation.whoExceeded
                ? 'border-[#fca5a5] bg-[#ffdad6]/40'
                : 'border-[#bbf7d0] bg-[#dcfce7]/50'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {calculation.whoExceeded ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-[#ba1a1a]" aria-hidden="true" />
                  <span className="text-[#93000a]">WHO 2021 Guideline Exceeded</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-[#15803d]" aria-hidden="true" />
                  <span className="text-[#14532d]">Within WHO 2021 Limit</span>
                </>
              )}
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-[#131b2e] tabular-nums">
              {calculation.whoRatio}×{' '}
              <span className="text-xs font-normal text-slate-600">
                (limit: {spec.whoLimit} {UNIT_LABELS[spec.whoUnit]})
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Enter a non-negative concentration value above to calculate conversions and CPCB/WHO benchmarks.
        </p>
      )}
    </section>
  );
};
