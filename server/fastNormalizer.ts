import {
  computeCpcbNaqiSubIndex,
  convertAirPollutant,
  POLLUTANTS,
  type PollutantKey,
  type UnitKey,
} from '../src/utils/airQualityMath.ts';
import type {
  HygieneIssue,
  NaqiCategory,
  NormalizationResult,
  NormalizedReading,
  ReadingStatus,
  SourceRow,
  StationSummary,
} from '../src/types/vayu.ts';

const MISSING_TOKENS = new Set([
  '',
  'na',
  'n/a',
  'null',
  'none',
  'nan',
  '-',
  '--',
  '---',
  'missing',
  'dropout',
  'offline',
  'err',
  'error',
]);

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const IMPLAUSIBLE_UPPER_LIMIT: Record<PollutantKey, number> = {
  'PM2.5': 1000,
  PM10: 1500,
  NO2: 1000,
  SO2: 1600,
  CO: 50,
  O3: 1000,
};

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

function toHour24(hourStr: string, ampm?: string): string {
  let h = Number(hourStr);
  if (!Number.isFinite(h)) return '00';
  const meridiem = (ampm || '').toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return pad2(Math.min(23, Math.max(0, h)));
}

export function normalizeTimestampToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || MISSING_TOKENS.has(trimmed.toLowerCase())) return null;

  // Already ISO-like with timezone (e.g. 2026-11-14T07:15+05:30 or Z)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const normalized = trimmed.replace(' ', 'T');
    return /T\d{2}:\d{2}:\d{2}/.test(normalized)
      ? normalized
      : normalized.replace(/(Z|[+-]\d{2}:?\d{2})$/, ':00$1');
  }

  // YYYY-MM-DD or YYYY/MM/DD with optional time + AM/PM
  let m = trimmed.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (m) {
    const [, y, mo, d, hh = '00', mm = '00', ss = '00', ap] = m;
    return `${y}-${pad2(mo)}-${pad2(d)}T${toHour24(hh, ap)}:${pad2(mm)}:${pad2(ss)}+05:30`;
  }

  // DD/MM/YYYY or DD-MM-YYYY with optional time + AM/PM
  m = trimmed.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (m) {
    const [, d, mo, yRaw, hh = '00', mm = '00', ss = '00', ap] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    if (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${pad2(mo)}-${pad2(d)}T${toHour24(hh, ap)}:${pad2(mm)}:${pad2(ss)}+05:30`;
    }
  }

  // DD-MMM-YYYY or DD-MMM-YY with optional time + AM/PM (e.g., 14-Nov-26 08:00 AM)
  m = trimmed.match(
    /^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (m) {
    const [, d, monName, yRaw, hh = '00', mm = '00', ss = '00', ap] = m;
    const mo = MONTHS[monName.toLowerCase()];
    if (mo) {
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${mo}-${pad2(d)}T${toHour24(hh, ap)}:${pad2(mm)}:${pad2(ss)}+05:30`;
    }
  }

  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return null;
}

function canonicalizePollutant(raw: string | undefined): PollutantKey | 'AQI' | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (cleaned === 'pm2.5' || cleaned === 'pm25') return 'PM2.5';
  if (cleaned === 'pm10') return 'PM10';
  if (cleaned === 'no2' || cleaned === 'nitrogendioxide') return 'NO2';
  if (cleaned === 'so2' || cleaned === 'sulfurdioxide' || cleaned === 'sulphurdioxide') {
    return 'SO2';
  }
  if (cleaned === 'co' || cleaned === 'carbonmonoxide') return 'CO';
  if (cleaned === 'o3' || cleaned === 'ozone') return 'O3';
  if (cleaned === 'aqi' || cleaned === 'naqi' || cleaned === 'cpcbnaqi') return 'AQI';
  return null;
}

function canonicalizeUnit(raw: string | undefined, pollutant: PollutantKey | 'AQI'): UnitKey | 'NAQI' | null {
  const cleaned = (raw || '').trim().toLowerCase();
  if (pollutant === 'AQI' || cleaned === 'raw_index' || cleaned === 'naqi' || cleaned === 'aqi' || cleaned === 'index') {
    return 'NAQI';
  }
  if (!cleaned) {
    return pollutant === 'CO' ? 'mg/m3' : 'ug/m3';
  }
  if (
    cleaned === 'ug/m3' ||
    cleaned === 'µg/m³' ||
    cleaned === 'ug/m³' ||
    cleaned === 'mcg/m3' ||
    cleaned.includes('ug/m') ||
    cleaned.includes('µg/m')
  ) {
    return 'ug/m3';
  }
  if (cleaned === 'mg/m3' || cleaned === 'mg/m³' || cleaned.includes('mg/m')) {
    return 'mg/m3';
  }
  if (cleaned === 'ppb') return 'ppb';
  if (cleaned === 'ppm') return 'ppm';
  return null;
}

function aqiCategoryFromValue(aqi: number): NaqiCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function findFieldByKeyPattern(
  fields: Record<string, string>,
  patterns: RegExp[]
): { key: string; value: string } | null {
  const entries = Object.entries(fields);
  for (const pattern of patterns) {
    for (const [key, value] of entries) {
      if (pattern.test(key)) {
        return { key, value: value ?? '' };
      }
    }
  }
  return null;
}

function extractNumericAndUnit(rawVal: string): { numStr: string; embeddedUnit?: string } {
  const trimmed = rawVal.trim();
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-zA-Zµ³/]+)?$/);
  if (match) {
    return { numStr: match[1], embeddedUnit: match[2] };
  }
  return { numStr: trimmed };
}

function tryParseWidePollutantRow(
  row: SourceRow,
  timestampRaw: string,
  station: string,
  notesRaw: string
): NormalizedReading | null {
  const candidates: NormalizedReading[] = [];
  for (const [key, val] of Object.entries(row.rawFields)) {
    const pol = canonicalizePollutant(key.replace(/\(.*\)/, ''));
    if (!pol || pol === 'AQI') continue;
    const rawVal = (val ?? '').trim();
    if (!rawVal) continue;
    const unitHintMatch = key.match(/\(([^)]+)\)/);
    const extracted = extractNumericAndUnit(rawVal);
    candidates.push(
      buildNormalizedReading({
        rowIndex: row.rowIndex,
        timestampRaw,
        station,
        pollutant: pol,
        rawValue: rawVal,
        rawUnit: extracted.embeddedUnit || unitHintMatch?.[1] || (pol === 'CO' ? 'mg/m3' : 'ug/m3'),
        notesRaw,
      })
    );
  }
  if (candidates.length === 0) return null;
  // Prioritize surfacing any anomaly or missing reading first, otherwise highest NAQI sub-index
  const anomaly = candidates.find((c) => c.status === 'anomaly');
  if (anomaly) return anomaly;
  const sorted = [...candidates].sort((a, b) => (b.naqiSubIndex ?? -1) - (a.naqiSubIndex ?? -1));
  return sorted[0];
}

function tryParseUnstructuredLine(row: SourceRow): NormalizedReading | null {
  const text = row.rawText.trim();
  if (!text) return null;

  const polMatch = text.match(/\b(PM\s*2\.5|PM25|PM\s*10|NO2|SO2|O3|CO|AQI|NAQI)\b/i);
  if (!polMatch) return null;
  const pol = canonicalizePollutant(polMatch[1]);
  if (!pol) return null;

  const valMatch = text.match(
    /(?:PM\s*2\.5|PM25|PM\s*10|NO2|SO2|O3|CO|AQI|NAQI)\s*[:=\s]+\s*([+-]?\d+(?:\.\d+)?|NA|N\/A|--|missing)\s*(µg\/m³|ug\/m3|mg\/m3|ppb|ppm|raw_index|naqi)?/i
  );
  if (!valMatch) return null;

  const tsMatch = text.match(
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:\s+\d{1,2}:\d{2})?)/
  );

  const stationMatch = text.match(/(?:station|ward|zone|site|at)\s*[:=]?\s*([A-Za-z0-9\s-]{3,35})/i);

  return buildNormalizedReading({
    rowIndex: row.rowIndex,
    timestampRaw: tsMatch?.[1] || '',
    station: stationMatch?.[1]?.trim() || 'Field Sensor Log',
    pollutant: pol,
    rawValue: valMatch[1],
    rawUnit: valMatch[2] || (pol === 'CO' ? 'mg/m3' : pol === 'AQI' ? 'raw_index' : 'ug/m3'),
    notesRaw: text,
  });
}

function buildNormalizedReading(params: {
  rowIndex: number;
  timestampRaw: string;
  station: string;
  pollutant: PollutantKey | 'AQI';
  rawValue: string;
  rawUnit: string;
  notesRaw: string;
}): NormalizedReading {
  const { rowIndex, timestampRaw, station, pollutant, rawValue, rawUnit, notesRaw } = params;
  const timestampIso = normalizeTimestampToIso(timestampRaw);
  const cleanStation = station.trim() || 'Unspecified Station';
  const cleanRawValue = rawValue.trim();

  const missingTimestampNote =
    !timestampRaw.trim() || timestampIso === null ? 'Timestamp missing or unparseable. ' : '';

  if (MISSING_TOKENS.has(cleanRawValue.toLowerCase())) {
    return {
      rowIndex,
      timestampIso,
      station: cleanStation,
      pollutant,
      rawValue: cleanRawValue || 'empty',
      rawUnit: rawUnit.trim(),
      normalizedValue: null,
      normalizedUnit: pollutant === 'CO' ? 'mg/m3' : pollutant === 'AQI' ? 'NAQI' : 'ug/m3',
      naqiSubIndex: null,
      naqiCategory: 'Unavailable',
      whoExceeded: false,
      whoGuideline:
        pollutant === 'AQI'
          ? 'CPCB Aggregate Index'
          : `${POLLUTANTS[pollutant].whoLimit} ${POLLUTANTS[pollutant].whoUnit} (24h)`,
      status: 'missing',
      conversionNote: 'Missing reading kept strictly null (no imputation)',
      issueNote: `${missingTimestampNote}${notesRaw ? `${notesRaw}. ` : ''}Missing or sensor-dropout value.`,
    };
  }

  const extracted = extractNumericAndUnit(cleanRawValue);
  const numericVal = Number(extracted.numStr);
  const resolvedRawUnit = rawUnit.trim() || extracted.embeddedUnit || '';

  if (!Number.isFinite(numericVal)) {
    return {
      rowIndex,
      timestampIso,
      station: cleanStation,
      pollutant,
      rawValue: cleanRawValue,
      rawUnit: resolvedRawUnit,
      normalizedValue: null,
      normalizedUnit: pollutant === 'CO' ? 'mg/m3' : pollutant === 'AQI' ? 'NAQI' : 'ug/m3',
      naqiSubIndex: null,
      naqiCategory: 'Unavailable',
      whoExceeded: false,
      whoGuideline:
        pollutant === 'AQI'
          ? 'CPCB Aggregate Index'
          : `${POLLUTANTS[pollutant].whoLimit} ${POLLUTANTS[pollutant].whoUnit} (24h)`,
      status: 'missing',
      conversionNote: 'Non-numeric reading preserved as null',
      issueNote: `${missingTimestampNote}Unparseable numeric reading "${cleanRawValue}".`,
    };
  }

  // Raw AQI / NAQI entry
  if (pollutant === 'AQI') {
    if (numericVal < 0 || numericVal > 1000) {
      return {
        rowIndex,
        timestampIso,
        station: cleanStation,
        pollutant: 'AQI',
        rawValue: cleanRawValue,
        rawUnit: resolvedRawUnit || 'NAQI',
        normalizedValue: numericVal,
        normalizedUnit: 'NAQI',
        naqiSubIndex: null,
        naqiCategory: 'Unavailable',
        whoExceeded: false,
        whoGuideline: 'CPCB Aggregate Index',
        status: 'anomaly',
        conversionNote: 'Raw index outside physical 0–500 range',
        issueNote: `${missingTimestampNote}${notesRaw || 'Anomalous AQI index value.'}`,
      };
    }

    const roundedAqi = Math.round(numericVal);
    return {
      rowIndex,
      timestampIso,
      station: cleanStation,
      pollutant: 'AQI',
      rawValue: cleanRawValue,
      rawUnit: resolvedRawUnit || 'raw_index',
      normalizedValue: roundedAqi,
      normalizedUnit: 'NAQI',
      naqiSubIndex: roundedAqi,
      naqiCategory: aqiCategoryFromValue(roundedAqi),
      whoExceeded: roundedAqi > 100,
      whoGuideline: 'CPCB Moderate Threshold (>100 NAQI)',
      status: 'valid',
      conversionNote: 'Display board index mapped to CPCB NAQI band',
      issueNote: missingTimestampNote.trim(),
    };
  }

  const spec = POLLUTANTS[pollutant];
  const fromUnit = canonicalizeUnit(resolvedRawUnit, pollutant);
  if (!fromUnit || fromUnit === 'NAQI') {
    return {
      rowIndex,
      timestampIso,
      station: cleanStation,
      pollutant,
      rawValue: cleanRawValue,
      rawUnit: resolvedRawUnit,
      normalizedValue: null,
      normalizedUnit: spec.whoUnit,
      naqiSubIndex: null,
      naqiCategory: 'Unavailable',
      whoExceeded: false,
      whoGuideline: `${spec.whoLimit} ${spec.whoUnit}`,
      status: 'anomaly',
      conversionNote: `Unrecognized unit "${resolvedRawUnit}"`,
      issueNote: `${missingTimestampNote}Unit "${resolvedRawUnit}" could not be verified.`,
    };
  }

  // Negative value -> calibration fault anomaly
  if (numericVal < 0) {
    return {
      rowIndex,
      timestampIso,
      station: cleanStation,
      pollutant,
      rawValue: cleanRawValue,
      rawUnit: resolvedRawUnit || fromUnit,
      normalizedValue: numericVal,
      normalizedUnit: spec.whoUnit,
      naqiSubIndex: null,
      naqiCategory: 'Unavailable',
      whoExceeded: false,
      whoGuideline: `${spec.whoLimit} ${spec.whoUnit}`,
      status: 'anomaly',
      conversionNote: 'Negative sensor reading rejected from CPCB index',
      issueNote: `${missingTimestampNote}${notesRaw || 'Negative concentration indicates sensor calibration fault.'}`,
    };
  }

  const converted = convertAirPollutant({
    pollutant,
    inputValue: numericVal,
    fromUnit,
    toUnit: spec.whoUnit,
    tempCelsius: 25,
  });

  if (!converted.valid || converted.cpcbValue === null || !converted.naqi) {
    return {
      rowIndex,
      timestampIso,
      station: cleanStation,
      pollutant,
      rawValue: cleanRawValue,
      rawUnit: resolvedRawUnit || fromUnit,
      normalizedValue: null,
      normalizedUnit: spec.whoUnit,
      naqiSubIndex: null,
      naqiCategory: 'Unavailable',
      whoExceeded: false,
      whoGuideline: `${spec.whoLimit} ${spec.whoUnit}`,
      status: 'anomaly',
      conversionNote: converted.unsupportedReason || 'Conversion not valid',
      issueNote: `${missingTimestampNote}${converted.unsupportedReason || 'Incompatible unit.'}`,
    };
  }

  const normalizedVal = Number(converted.cpcbValue.toFixed(2));
  const upperLimit = IMPLAUSIBLE_UPPER_LIMIT[pollutant];
  const isImplausibleSpike = normalizedVal > upperLimit;
  const status: ReadingStatus = isImplausibleSpike ? 'anomaly' : 'valid';

  const unitConverted = fromUnit !== spec.whoUnit;
  const conversionNote = unitConverted
    ? `Converted ${numericVal} ${fromUnit} → ${normalizedVal} ${spec.whoUnit} (25°C, 1 atm)`
    : `Direct ${spec.whoUnit} verified`;

  const issueNoteParts: string[] = [];
  if (missingTimestampNote) issueNoteParts.push(missingTimestampNote.trim());
  if (isImplausibleSpike) {
    issueNoteParts.push(
      notesRaw
        ? `Implausible spike (${normalizedVal} ${spec.whoUnit} > ${upperLimit}): ${notesRaw}`
        : `Implausible spike (${normalizedVal} ${spec.whoUnit}) exceeds ambient bound (${upperLimit}).`
    );
  }

  return {
    rowIndex,
    timestampIso,
    station: cleanStation,
    pollutant,
    rawValue: cleanRawValue,
    rawUnit: resolvedRawUnit || fromUnit,
    normalizedValue: normalizedVal,
    normalizedUnit: spec.whoUnit,
    naqiSubIndex: converted.naqi.index,
    naqiCategory: converted.naqi.category as NaqiCategory,
    whoExceeded: converted.whoExceeded,
    whoGuideline: `${spec.whoLimit} ${spec.whoUnit}`,
    status,
    conversionNote,
    issueNote: issueNoteParts.join(' '),
  };
}

export function fastNormalizeSourceRows(
  sourceRows: SourceRow[],
  datasetTitle?: string
): {
  result: NormalizationResult;
  ambiguousRows: SourceRow[];
} {
  const readings: NormalizedReading[] = [];
  const ambiguousRows: SourceRow[] = [];

  for (const row of sourceRows) {
    const fields = row.rawFields;
    const tsField = findFieldByKeyPattern(fields, [
      /timestamp|date_?time|recorded|observed|time|date/i,
      /^column_1$/i,
    ]);
    const stationField = findFieldByKeyPattern(fields, [
      /station|zone|ward|location|site|area|city|sector/i,
      /^column_2$/i,
    ]);
    const pollutantField = findFieldByKeyPattern(fields, [
      /pollutant|parameter|param|species|metric/i,
      /^column_3$/i,
    ]);
    const valueField = findFieldByKeyPattern(fields, [
      /^value$|val|reading|conc|concentration|measurement|level|avg/i,
      /^column_4$/i,
    ]);
    const unitField = findFieldByKeyPattern(fields, [/unit|uom/i, /^column_5$/i]);
    const notesField = findFieldByKeyPattern(fields, [/note|remark|comment|status|flag/i]);

    const tsRaw = tsField?.value || '';
    const stationRaw = stationField?.value || '';
    const notesRaw = notesField?.value || '';

    const pol = canonicalizePollutant(pollutantField?.value);
    if (pol && valueField) {
      readings.push(
        buildNormalizedReading({
          rowIndex: row.rowIndex,
          timestampRaw: tsRaw,
          station: stationRaw,
          pollutant: pol,
          rawValue: valueField.value,
          rawUnit: unitField?.value || '',
          notesRaw,
        })
      );
      continue;
    }

    const wideParsed = tryParseWidePollutantRow(row, tsRaw, stationRaw, notesRaw);
    if (wideParsed) {
      readings.push(wideParsed);
      continue;
    }

    const lineParsed = tryParseUnstructuredLine(row);
    if (lineParsed) {
      readings.push(lineParsed);
      continue;
    }

    // Could not deterministically extract pollutant/value — fall back to missing + mark ambiguous
    ambiguousRows.push(row);
    readings.push({
      rowIndex: row.rowIndex,
      timestampIso: normalizeTimestampToIso(tsRaw),
      station: stationRaw || 'Unspecified Station',
      pollutant: pollutantField?.value || 'Unknown',
      rawValue: valueField?.value || row.rawText,
      rawUnit: unitField?.value || '',
      normalizedValue: null,
      normalizedUnit: 'N/A',
      naqiSubIndex: null,
      naqiCategory: 'Unavailable',
      whoExceeded: false,
      whoGuideline: 'Not evaluated',
      status: 'missing',
      conversionNote: 'Awaiting AI field extraction',
      issueNote: 'Row format could not be parsed cleanly.',
    });
  }

  return {
    result: aggregateNormalization(readings, datasetTitle),
    ambiguousRows,
  };
}

export interface AiRowAuditCorrection {
  rowIndex: number;
  status?: ReadingStatus;
  pollutant?: string;
  station?: string;
  timestampIso?: string | null;
  normalizedValue?: number | null;
  normalizedUnit?: string;
  issueNote?: string;
}

export function applyAiAuditCorrections(
  baseResult: NormalizationResult,
  corrections: AiRowAuditCorrection[],
  aiIssues: HygieneIssue[],
  datasetTitle?: string
): NormalizationResult {
  const maxRow = baseResult.totalSourceRows;
  const byRow = new Map<number, NormalizedReading>(
    baseResult.readings.map((r) => [r.rowIndex, { ...r }])
  );

  for (const corr of corrections) {
    const idx = Number(corr.rowIndex);
    if (!Number.isInteger(idx) || idx < 1 || idx > maxRow) continue;
    const existing = byRow.get(idx);
    if (!existing) continue;

    const updated: NormalizedReading = { ...existing };
    if (corr.station && corr.station.trim()) {
      updated.station = corr.station.trim();
    }
    if (corr.timestampIso !== undefined) {
      updated.timestampIso = corr.timestampIso;
    }
    if (corr.pollutant && corr.pollutant.trim()) {
      const canonical = canonicalizePollutant(corr.pollutant);
      updated.pollutant = canonical || corr.pollutant.trim();
    }

    // If AI extracted a numeric value for a previously unparsed row, recompute CPCB NAQI deterministically
    if (corr.normalizedValue === null) {
      updated.normalizedValue = null;
      updated.naqiSubIndex = null;
      updated.naqiCategory = 'Unavailable';
      updated.whoExceeded = false;
      updated.status = corr.status === 'anomaly' ? 'anomaly' : 'missing';
    } else if (typeof corr.normalizedValue === 'number' && Number.isFinite(corr.normalizedValue)) {
      const canonicalPol = canonicalizePollutant(updated.pollutant);
      if (canonicalPol && canonicalPol !== 'AQI') {
        const spec = POLLUTANTS[canonicalPol];
        const unit = canonicalizeUnit(corr.normalizedUnit || updated.normalizedUnit, canonicalPol);
        if (corr.normalizedValue < 0) {
          updated.normalizedValue = corr.normalizedValue;
          updated.normalizedUnit = spec.whoUnit;
          updated.naqiSubIndex = null;
          updated.naqiCategory = 'Unavailable';
          updated.whoExceeded = false;
          updated.status = 'anomaly';
        } else {
          const conv = convertAirPollutant({
            pollutant: canonicalPol,
            inputValue: corr.normalizedValue,
            fromUnit: unit && unit !== 'NAQI' ? unit : spec.whoUnit,
            toUnit: spec.whoUnit,
            tempCelsius: 25,
          });
          if (conv.valid && conv.cpcbValue !== null && conv.naqi) {
            updated.normalizedValue = Number(conv.cpcbValue.toFixed(2));
            updated.normalizedUnit = spec.whoUnit;
            updated.naqiSubIndex = conv.naqi.index;
            updated.naqiCategory = conv.naqi.category as NaqiCategory;
            updated.whoExceeded = conv.whoExceeded;
            updated.whoGuideline = `${spec.whoLimit} ${spec.whoUnit}`;
          }
        }
      } else if (canonicalPol === 'AQI') {
        const rounded = Math.round(corr.normalizedValue);
        updated.normalizedValue = rounded;
        updated.normalizedUnit = 'NAQI';
        updated.naqiSubIndex = rounded >= 0 && rounded <= 1000 ? rounded : null;
        updated.naqiCategory =
          rounded >= 0 && rounded <= 1000 ? aqiCategoryFromValue(rounded) : 'Unavailable';
        updated.whoExceeded = rounded > 100;
      }
    }

    if (corr.status === 'valid' || corr.status === 'missing' || corr.status === 'anomaly') {
      updated.status = corr.status;
      if (corr.status === 'missing') {
        updated.normalizedValue = null;
        updated.naqiSubIndex = null;
        updated.naqiCategory = 'Unavailable';
        updated.whoExceeded = false;
      }
    }

    if (corr.issueNote && corr.issueNote.trim()) {
      updated.issueNote = corr.issueNote.trim();
    }

    byRow.set(idx, updated);
  }

  const orderedReadings = Array.from(byRow.values()).sort((a, b) => a.rowIndex - b.rowIndex);
  const aggregated = aggregateNormalization(orderedReadings, datasetTitle || baseResult.datasetTitle);

  // Merge AI-surfaced hygiene issues while keeping deterministic row-count accuracy
  const validAiIssues = aiIssues
    .map((issue, idx) => ({
      ...issue,
      id: issue.id || `ai-issue-${idx + 1}`,
      affectedRows: issue.affectedRows.filter((n) => Number.isInteger(n) && n >= 1 && n <= maxRow),
    }))
    .filter((issue) => issue.affectedRows.length > 0);

  if (validAiIssues.length > 0) {
    // Keep deterministic structural issues whose severity isn't duplicated, plus AI semantic issues
    const aiSeverities = new Set(validAiIssues.map((i) => i.severity));
    const retainedDeterministic = aggregated.issues.filter((i) => !aiSeverities.has(i.severity));
    aggregated.issues = [...retainedDeterministic, ...validAiIssues];
  }

  return aggregated;
}

export function aggregateNormalization(
  readings: NormalizedReading[],
  datasetTitle?: string
): NormalizationResult {
  const validReadings = readings.filter((r) => r.status === 'valid');
  const missingReadings = readings.filter((r) => r.status === 'missing');
  const anomalyReadings = readings.filter((r) => r.status === 'anomaly');

  const validSubIndices = validReadings
    .map((r) => ({ sub: r.naqiSubIndex, pollutant: r.pollutant }))
    .filter((x): x is { sub: number; pollutant: string } => typeof x.sub === 'number');

  const peakEntry = validSubIndices.reduce<{ sub: number; pollutant: string } | null>(
    (best, cur) => (!best || cur.sub > best.sub ? cur : best),
    null
  );

  const overallNaqi = peakEntry ? peakEntry.sub : null;
  const overallCategory: NaqiCategory =
    overallNaqi !== null ? aqiCategoryFromValue(overallNaqi) : 'Unavailable';

  // Build deterministic HygieneIssues
  const issues: HygieneIssue[] = [];
  if (missingReadings.length > 0) {
    issues.push({
      id: 'issue-gaps',
      severity: 'gap',
      title: `${missingReadings.length} Missing / Sensor-Dropout Reading(s)`,
      explanation:
        'Missing, NA, or blank sensor intervals were preserved strictly as null rather than interpolated.',
      affectedRows: missingReadings.map((r) => r.rowIndex),
      reliabilityImpact: 'Reduces temporal completeness across affected monitoring intervals.',
    });
  }

  if (anomalyReadings.length > 0) {
    issues.push({
      id: 'issue-anomalies',
      severity: 'outlier',
      title: `${anomalyReadings.length} Anomalous Spike / Calibration Fault(s)`,
      explanation:
        'Negative readings, statistical outliers, or extreme spikes were quarantined from confirmed exposure averages.',
      affectedRows: anomalyReadings.map((r) => r.rowIndex),
      reliabilityImpact: 'Must be verified before triggering irreversible civic shutdowns.',
    });
  }

  const badTimestampRows = readings.filter((r) => r.timestampIso === null).map((r) => r.rowIndex);
  if (badTimestampRows.length > 0) {
    issues.push({
      id: 'issue-timestamps',
      severity: 'format',
      title: `${badTimestampRows.length} Missing or Non-ISO Timestamp(s)`,
      explanation:
        'Mixed date formats or missing timestamps were flagged; valid formats were standardized to ISO-8601 (+05:30).',
      affectedRows: badTimestampRows,
      reliabilityImpact: 'Time-series sequencing relies on remaining timestamped rows.',
    });
  }

  const convertedRows = readings
    .filter((r) => r.conversionNote.startsWith('Converted '))
    .map((r) => r.rowIndex);
  if (convertedRows.length > 0) {
    issues.push({
      id: 'issue-units',
      severity: 'unit_mismatch',
      title: `${convertedRows.length} Mixed Gas Unit(s) Converted (ppm/ppb → CPCB)`,
      explanation:
        'Trace gas readings reported in ppm/ppb were converted to CPCB standard units (µg/m³ or mg/m³) at 25°C, 1 atm.',
      affectedRows: convertedRows,
      reliabilityImpact: 'Enables direct WHO 2021 and CPCB NAQI comparison across heterogeneous logs.',
    });
  }

  // Group stationSummaries
  const stationMap = new Map<string, NormalizedReading[]>();
  for (const r of readings) {
    const key = r.station;
    const list = stationMap.get(key) || [];
    list.push(r);
    stationMap.set(key, list);
  }

  const stationSummaries: StationSummary[] = Array.from(stationMap.entries()).map(
    ([station, list]) => {
      const validList = list.filter((r) => r.status === 'valid' && typeof r.naqiSubIndex === 'number');
      const peak = validList.reduce<NormalizedReading | null>(
        (best, cur) =>
          !best || (cur.naqiSubIndex ?? 0) > (best.naqiSubIndex ?? 0) ? cur : best,
        null
      );
      return {
        station,
        readingCount: list.length,
        validCount: list.filter((r) => r.status === 'valid').length,
        gapCount: list.filter((r) => r.status === 'missing').length,
        anomalyCount: list.filter((r) => r.status === 'anomaly').length,
        peakNaqi: peak?.naqiSubIndex ?? null,
        peakCategory: peak?.naqiCategory ?? 'Unavailable',
        dominantPollutant: peak?.pollutant ?? list[0]?.pollutant ?? 'Unknown',
        whoExceedanceCount: list.filter((r) => r.whoExceeded && r.status === 'valid').length,
        citedRows: list.map((r) => r.rowIndex),
      };
    }
  );

  const validRatio = readings.length > 0 ? validReadings.length / readings.length : 0;
  const overallConfidence: 'High' | 'Moderate' | 'Low' =
    validRatio >= 0.85 && anomalyReadings.length === 0
      ? 'High'
      : validRatio >= 0.6
        ? 'Moderate'
        : 'Low';

  return {
    datasetTitle: datasetTitle?.trim() || 'Air Quality Monitoring Batch',
    totalSourceRows: readings.length,
    validCount: validReadings.length,
    gapCount: missingReadings.length,
    anomalyCount: anomalyReadings.length,
    overallConfidence,
    overallNaqi,
    overallCategory,
    dominantPollutant: peakEntry?.pollutant || readings[0]?.pollutant || 'PM2.5',
    readings,
    issues,
    stationSummaries,
  };
}
