export type PollutantKey = 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3';
export type UnitKey = 'ug/m3' | 'mg/m3' | 'ppm' | 'ppb';

export interface NaqiBreakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  cat: string;
}

export interface PollutantSpec {
  label: string;
  molarMass: number | null; // g/mol (null for particulate matter)
  whoLimit: number;
  whoUnit: 'ug/m3' | 'mg/m3';
  cpcbBreakpoints: NaqiBreakpoint[];
}

export const POLLUTANTS: Record<PollutantKey, PollutantSpec> = {
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
    label: 'O3 (Ground-level Ozone)',
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

export function computeCpcbNaqiSubIndex(
  pollutant: PollutantKey,
  concentrationInCpcbUnit: number
): { index: number; category: string } {
  const table = POLLUTANTS[pollutant].cpcbBreakpoints;
  if (!Number.isFinite(concentrationInCpcbUnit) || concentrationInCpcbUnit < 0) {
    return { index: 0, category: 'Unavailable' };
  }
  for (const row of table) {
    if (concentrationInCpcbUnit <= row.cHigh) {
      const sub =
        ((row.iHigh - row.iLow) / Math.max(0.0001, row.cHigh - row.cLow)) *
          (concentrationInCpcbUnit - row.cLow) +
        row.iLow;
      return { index: Math.round(sub), category: row.cat };
    }
  }
  return { index: 500, category: 'Severe' };
}

export interface PollutantConversionResult {
  valid: boolean;
  unsupportedReason?: string;
  convertedValue: number | null;
  ugm3: number | null;
  mgm3: number | null;
  ppm: number | null;
  ppb: number | null;
  cpcbUnit: 'ug/m3' | 'mg/m3';
  cpcbValue: number | null;
  naqi: { index: number; category: string } | null;
  whoExceeded: boolean;
  whoMultiple: number | null;
}

export function convertAirPollutant(params: {
  pollutant: PollutantKey;
  inputValue: number;
  fromUnit: UnitKey;
  toUnit: UnitKey;
  tempCelsius?: number;
}): PollutantConversionResult {
  const { pollutant, inputValue, fromUnit, toUnit, tempCelsius = 25 } = params;
  const spec = POLLUTANTS[pollutant];
  const invalidBase: PollutantConversionResult = {
    valid: false,
    convertedValue: null,
    ugm3: null,
    mgm3: null,
    ppm: null,
    ppb: null,
    cpcbUnit: spec.whoUnit,
    cpcbValue: null,
    naqi: null,
    whoExceeded: false,
    whoMultiple: null,
  };

  if (!Number.isFinite(inputValue) || inputValue < 0) {
    return { ...invalidBase, unsupportedReason: 'Enter a valid non-negative concentration.' };
  }

  if (spec.molarMass === null && (fromUnit === 'ppm' || fromUnit === 'ppb')) {
    return {
      ...invalidBase,
      unsupportedReason: `${pollutant} is particulate matter (mass/volume) and cannot be converted from ppm/ppb.`,
    };
  }
  if (spec.molarMass === null && (toUnit === 'ppm' || toUnit === 'ppb')) {
    return {
      ...invalidBase,
      unsupportedReason: `${pollutant} uses µg/m³ or mg/m³ only (particulate matter has no fixed molar mass).`,
    };
  }

  // Ideal gas molar volume at 1 atm & selected ambient temperature (K): Vm = 22.414 * (T_K / 273.15)
  const clampedTemp = Number.isFinite(tempCelsius) ? Math.min(60, Math.max(-20, tempCelsius)) : 25;
  const molarVolume = 22.414 * ((clampedTemp + 273.15) / 273.15);

  let ugm3 = 0;
  if (fromUnit === 'ug/m3') {
    ugm3 = inputValue;
  } else if (fromUnit === 'mg/m3') {
    ugm3 = inputValue * 1000;
  } else if (fromUnit === 'ppb' && spec.molarMass) {
    ugm3 = inputValue * (spec.molarMass / molarVolume);
  } else if (fromUnit === 'ppm' && spec.molarMass) {
    ugm3 = inputValue * 1000 * (spec.molarMass / molarVolume);
  }

  const mgm3 = ugm3 / 1000;
  const ppb = spec.molarMass ? ugm3 * (molarVolume / spec.molarMass) : null;
  const ppm = ppb !== null ? ppb / 1000 : null;

  let convertedValue: number | null = ugm3;
  if (toUnit === 'mg/m3') convertedValue = mgm3;
  else if (toUnit === 'ppb') convertedValue = ppb;
  else if (toUnit === 'ppm') convertedValue = ppm;

  const cpcbValue = spec.whoUnit === 'mg/m3' ? mgm3 : ugm3;
  const naqi = computeCpcbNaqiSubIndex(pollutant, cpcbValue);
  const whoExceeded = cpcbValue > spec.whoLimit;
  const whoMultiple = Number((cpcbValue / spec.whoLimit).toFixed(2));

  return {
    valid: true,
    convertedValue,
    ugm3,
    mgm3,
    ppm,
    ppb,
    cpcbUnit: spec.whoUnit,
    cpcbValue,
    naqi,
    whoExceeded,
    whoMultiple,
  };
}
