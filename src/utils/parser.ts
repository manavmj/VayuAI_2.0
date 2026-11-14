import * as XLSX from 'xlsx';
import type { SourceRow } from '../types/vayu.ts';

const MAX_ROWS = 150;

export const MESSY_TEST_FIXTURE = `Timestamp,Station_Zone,Pollutant,Value,Unit,Notes
14/11/2026 06:30,Anand Vihar Junction,PM2.5,268,ug/m3,Morning freight corridor
2026-11-14T07:15+05:30,Anand Vihar Junction,PM10,412,µg/m³,Heavy dust near metro work
14-Nov-26 08:00 AM,Anand Vihar Junction,NO2,48,ppb,Peak traffic hour
2026/11/14 08:30,Rohini Sector 11,PM2.5,142,ug/m3,School zone approach
14/11/2026 09:00,Rohini Sector 11,CO,2.6,ppm,Idling vans outside gate
14/11/2026 09:30,Rohini Sector 11,PM2.5,NA,ug/m3,Sensor dropout - power trip
,Rohini Sector 11,PM10,--,ug/m3,Missing timestamp and reading
14-Nov-2026 10:00,Okhla Phase II,PM2.5,189,µg/m³,Industrial belt baseline
14/11/2026 10:15,Okhla Phase II,PM2.5,1940,ug/m3,Sudden spike during diesel test
2026-11-14 10:30,Okhla Phase II,SO2,0.028,ppm,Brick kiln plume drift
14/11/2026 11:00,Dwarka Sector 9 RWA,PM2.5,78,ug/m3,Residential park sensor
14/11/2026 11:15,Dwarka Sector 9 RWA,PM10,-12,ug/m3,Negative sensor calibration fault
2026-11-14T11:30:00+05:30,Dwarka Sector 9 RWA,O3,118,ug/m3,Midday solar buildup
14/11/2026 12:00,Dwarka Sector 9 RWA,AQI,312,raw_index,Combined display board reading`;

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 5);
  const candidates = [',', '\t', '|', ';'];
  let best: string | null = null;
  let bestScore = 0;

  for (const delim of candidates) {
    const counts = sample.map((line) => splitDelimitedLine(line, delim).length);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    if (minCount >= 2 && maxCount - minCount <= 2) {
      const score = minCount * 10 - (maxCount - minCount);
      if (score > bestScore) {
        bestScore = score;
        best = delim;
      }
    }
  }
  return best;
}

export function parseRawTextToSourceRows(rawInput: string): {
  rows: SourceRow[];
  detectedFormat: string;
  truncatedCount: number;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { rows: [], detectedFormat: 'empty', truncatedCount: 0 };
  }

  const allLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^\|?[-:\s|]+\|?$/.test(line));

  const delimiter = detectDelimiter(allLines);

  if (delimiter) {
    const parsedLines = allLines.map((line) => {
      const cleanedLine =
        delimiter === '|' ? line.replace(/^\|/, '').replace(/\|$/, '') : line;
      return splitDelimitedLine(cleanedLine, delimiter);
    });

    const firstRow = parsedLines[0] ?? [];
    const looksLikeHeader = firstRow.some((cell) =>
      /(time|date|station|zone|location|site|pollutant|param|val|reading|unit|aqi|pm|no2|co|so2|o3)/i.test(
        cell
      )
    );

    const headers = looksLikeHeader
      ? firstRow.map((h, idx) => h || `Column_${idx + 1}`)
      : firstRow.map((_, idx) => `Column_${idx + 1}`);

    const dataLines = looksLikeHeader ? parsedLines.slice(1) : parsedLines;
    const truncatedCount = Math.max(0, dataLines.length - MAX_ROWS);
    const boundedLines = dataLines.slice(0, MAX_ROWS);

    const rows: SourceRow[] = boundedLines.map((cells, idx) => {
      const rawFields: Record<string, string> = {};
      const maxCols = Math.max(headers.length, cells.length);
      for (let c = 0; c < maxCols; c += 1) {
        const key = headers[c] ?? `Column_${c + 1}`;
        rawFields[key] = cells[c] ?? '';
      }
      return {
        rowIndex: idx + 1,
        rawText: allLines[looksLikeHeader ? idx + 1 : idx] ?? cells.join(delimiter),
        rawFields,
      };
    });

    const formatMap: Record<string, string> = {
      ',': 'CSV Table',
      '\t': 'Tab-Separated Table',
      '|': 'Pipe / Markdown Table',
      ';': 'Semicolon-Separated Table',
    };

    return {
      rows,
      detectedFormat: formatMap[delimiter] ?? 'Delimited Table',
      truncatedCount,
    };
  }

  // Unstructured or multi-line log entries
  const truncatedCount = Math.max(0, allLines.length - MAX_ROWS);
  const boundedLines = allLines.slice(0, MAX_ROWS);
  const rows: SourceRow[] = boundedLines.map((line, idx) => ({
    rowIndex: idx + 1,
    rawText: line,
    rawFields: { Raw_Line: line },
  }));

  return {
    rows,
    detectedFormat: 'Unstructured Sensor Log',
    truncatedCount,
  };
}

export async function parseFileToSourceRows(file: File): Promise<{
  rows: SourceRow[];
  detectedFormat: string;
  truncatedCount: number;
  rawPreviewText: string;
}> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
    const text = await file.text();
    const parsed = parseRawTextToSourceRows(text);
    return { ...parsed, rawPreviewText: text };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded workbook contains no readable worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const nonEmptyRows = matrix
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (nonEmptyRows.length === 0) {
    throw new Error('The selected spreadsheet is empty.');
  }

  const firstRow = nonEmptyRows[0];
  const looksLikeHeader = firstRow.some((cell) =>
    /(time|date|station|zone|location|site|pollutant|param|val|reading|unit|aqi|pm|no2|co|so2|o3)/i.test(
      cell
    )
  );
  const headers = looksLikeHeader
    ? firstRow.map((h, idx) => h || `Column_${idx + 1}`)
    : firstRow.map((_, idx) => `Column_${idx + 1}`);
  const dataRows = looksLikeHeader ? nonEmptyRows.slice(1) : nonEmptyRows;

  const truncatedCount = Math.max(0, dataRows.length - MAX_ROWS);
  const boundedRows = dataRows.slice(0, MAX_ROWS);

  const rows: SourceRow[] = boundedRows.map((cells, idx) => {
    const rawFields: Record<string, string> = {};
    const maxCols = Math.max(headers.length, cells.length);
    for (let c = 0; c < maxCols; c += 1) {
      const key = headers[c] ?? `Column_${c + 1}`;
      rawFields[key] = cells[c] ?? '';
    }
    return {
      rowIndex: idx + 1,
      rawText: cells.join(', '),
      rawFields,
    };
  });

  const rawPreviewText = nonEmptyRows
    .slice(0, MAX_ROWS + 1)
    .map((r) => r.join(', '))
    .join('\n');

  return {
    rows,
    detectedFormat: `Excel Workbook (${firstSheetName})`,
    truncatedCount,
    rawPreviewText,
  };
}
