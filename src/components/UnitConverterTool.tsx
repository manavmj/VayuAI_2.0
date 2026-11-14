import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Calculator, CheckCircle2 } from 'lucide-react';
import type { AdvisoryLanguage } from '../types/vayu.ts';
import {
  POLLUTANTS,
  convertAirPollutant,
  type PollutantKey,
  type UnitKey,
} from '../utils/airQualityMath.ts';

interface UnitConverterToolProps {
  language?: AdvisoryLanguage;
  compact?: boolean;
}

const UNIT_LABELS: Record<UnitKey, string> = {
  'ug/m3': 'µg/m³',
  'mg/m3': 'mg/m³',
  ppm: 'ppm',
  ppb: 'ppb',
};

function formatConc(val: number): string {
  if (!Number.isFinite(val)) return '—';
  if (val === 0) return '0';
  if (Math.abs(val) >= 100) return val.toFixed(1);
  if (Math.abs(val) >= 1) return val.toFixed(3);
  return val.toFixed(5);
}

export const UnitConverterTool: React.FC<UnitConverterToolProps> = ({
  language = 'en',
  compact = false,
}) => {
  const isHi = language === 'hi';
  const [pollutant, setPollutant] = useState<PollutantKey>('NO2');
  const [rawInput, setRawInput] = useState<string>('48');
  const [fromUnit, setFromUnit] = useState<UnitKey>('ppb');
  const [toUnit, setToUnit] = useState<UnitKey>('ug/m3');
  const [tempCelsius, setTempCelsius] = useState<number>(25);

  const spec = POLLUTANTS[pollutant];

  const handlePollutantChange = (next: PollutantKey) => {
    setPollutant(next);
    const nextSpec = POLLUTANTS[next];
    if (nextSpec.molarMass === null) {
      if (fromUnit === 'ppm' || fromUnit === 'ppb') setFromUnit('ug/m3');
      if (toUnit === 'ppm' || toUnit === 'ppb') setToUnit('mg/m3');
    } else if (next === 'CO') {
      setFromUnit('ppm');
      setToUnit('mg/m3');
    } else {
      setFromUnit('ppb');
      setToUnit('ug/m3');
    }
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const result = useMemo(() => {
    const val = Number.parseFloat(rawInput);
    return convertAirPollutant({
      pollutant,
      inputValue: val,
      fromUnit,
      toUnit,
      tempCelsius,
    });
  }, [pollutant, rawInput, fromUnit, toUnit, tempCelsius]);

  const availableUnits: UnitKey[] =
    spec.molarMass === null ? ['ug/m3', 'mg/m3'] : ['ug/m3', 'mg/m3', 'ppm', 'ppb'];

  return (
    <section
      aria-labelledby="unit-converter-heading"
      className={`rounded-2xl border border-[#16a34a]/20 bg-white ${
        compact ? 'p-5' : 'p-6 sm:p-7'
      } space-y-5`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            <span>
              {isHi ? 'प्रदूषक इकाई परिवर्तक और NAQI कैलकुलेटर' : 'Pollutant Unit Converter & CPCB NAQI Tool'}
            </span>
          </div>
          <h2
            id="unit-converter-heading"
            className="mt-1 font-display text-xl font-semibold text-[#131b2e]"
          >
            {isHi
              ? 'µg/m³, mg/m³, ppm और ppb को भारतीय NAQI मानकों में बदलें'
              : 'Convert µg/m³, mg/m³, ppm & ppb to Indian CPCB NAQI'}
          </h2>
          <p className="text-xs text-[#3f493f]">
            {isHi
              ? 'गैस रूपांतरण के लिए 1 atm और परिवेशी तापमान (°C) के साथ WHO 2021 सीमा जांच।'
              : 'Uses exact molecular weight and ideal gas molar volume at 1 atm with instant WHO 2021 threshold check.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="converter-temp" className="text-xs font-medium text-[#3f493f]">
            {isHi ? 'तापमान (°C):' : 'Ambient Temp (°C):'}
          </label>
          <input
            id="converter-temp"
            type="number"
            min={-10}
            max={55}
            value={tempCelsius}
            onChange={(e) => setTempCelsius(Number(e.target.value) || 25)}
            className="w-20 rounded-lg border border-slate-200 bg-[#faf8ff] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#131b2e] tabular-nums focus:border-[#16a34a] focus:outline-none"
          />
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3">
          <label htmlFor="conv-pollutant" className="block text-xs font-semibold text-[#3f493f]">
            {isHi ? 'प्रदूषक (Pollutant)' : 'Pollutant'}
          </label>
          <select
            id="conv-pollutant"
            value={pollutant}
            onChange={(e) => handlePollutantChange(e.target.value as PollutantKey)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 text-xs font-semibold text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
          >
            {(Object.keys(POLLUTANTS) as PollutantKey[]).map((key) => (
              <option key={key} value={key}>
                {POLLUTANTS[key].label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="conv-value" className="block text-xs font-semibold text-[#3f493f]">
            {isHi ? 'मान (Reading Value)' : 'Concentration Value'}
          </label>
          <input
            id="conv-value"
            type="number"
            min={0}
            step="any"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="e.g. 48"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 font-mono text-sm font-semibold text-[#131b2e] tabular-nums focus:border-[#16a34a] focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="conv-from" className="block text-xs font-semibold text-[#3f493f]">
            {isHi ? 'स्रोत इकाई' : 'From Unit'}
          </label>
          <select
            id="conv-from"
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value as UnitKey)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 font-mono text-xs font-semibold text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
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
            aria-label="Swap source and target units"
            className="rounded-lg border border-slate-200 bg-[#f0fdf4] p-2.5 text-[#15803d] hover:bg-[#dcfce7] transition-colors"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="conv-to" className="block text-xs font-semibold text-[#3f493f]">
            {isHi ? 'लक्ष्य इकाई' : 'Target Unit'}
          </label>
          <select
            id="conv-to"
            value={toUnit}
            onChange={(e) => setToUnit(e.target.value as UnitKey)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 font-mono text-xs font-semibold text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
          >
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Strip */}
      {!result.valid ? (
        <div
          role="alert"
          className="rounded-xl border border-[#eab308]/40 bg-[#fef9c3]/40 px-4 py-3 text-xs font-medium text-[#854d0e]"
        >
          {result.unsupportedReason}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-[#16a34a]/20 bg-[#f0fdf4]/50 p-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f493f]">
              {isHi ? 'रूपांतरित मान' : 'Converted Output'}
            </p>
            <p className="font-mono text-2xl font-bold text-[#00652c] tabular-nums">
              {formatConc(result.convertedValue ?? 0)}{' '}
              <span className="text-sm font-semibold">{UNIT_LABELS[toUnit]}</span>
            </p>
            <p className="font-mono text-[11px] text-slate-600 tabular-nums">
              CPCB Standard: {formatConc(result.cpcbValue ?? 0)} {UNIT_LABELS[result.cpcbUnit]}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f493f]">
              {isHi ? 'CPCB NAQI उप-सूचकांक' : 'CPCB NAQI Sub-Index'}
            </p>
            <p className="font-mono text-2xl font-bold text-[#131b2e] tabular-nums">
              {result.naqi?.index}{' '}
              <span className="text-sm font-sans font-semibold text-[#15803d]">
                ({result.naqi?.category})
              </span>
            </p>
            <p className="text-[11px] text-slate-600">
              {spec.molarMass
                ? `Molar Mass: ${spec.molarMass} g/mol @ ${tempCelsius}°C`
                : 'Gravimetric particulate concentration'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f493f]">
              {isHi ? 'WHO 2021 दिशानिर्देश जांच' : 'WHO 2021 Threshold Check'}
            </p>
            <div
              className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums ${
                result.whoExceeded ? 'text-[#ba1a1a]' : 'text-[#15803d]'
              }`}
            >
              {result.whoExceeded ? (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {result.whoExceeded
                  ? `${result.whoMultiple}x WHO Limit`
                  : `Within WHO (${result.whoMultiple}x)`}
              </span>
            </div>
            <p className="font-mono text-[11px] text-slate-600 tabular-nums">
              WHO 24h/8h Guideline: {spec.whoLimit} {UNIT_LABELS[spec.whoUnit]}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
