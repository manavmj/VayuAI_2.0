import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  MESSY_TEST_FIXTURE,
  parseFileToSourceRows,
  parseRawTextToSourceRows,
} from '../src/utils/parser.ts';

test('parseRawTextToSourceRows returns empty state for blank input', () => {
  const res = parseRawTextToSourceRows('   \n  ');
  assert.equal(res.rows.length, 0);
  assert.equal(res.detectedFormat, 'empty');
  assert.equal(res.truncatedCount, 0);
});

test('parseRawTextToSourceRows parses MESSY_TEST_FIXTURE with deterministic 1..14 row indices', () => {
  const res = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
  assert.equal(res.detectedFormat, 'CSV Table');
  assert.equal(res.rows.length, 14);
  assert.equal(res.truncatedCount, 0);
  assert.equal(res.rows[0].rowIndex, 1);
  assert.equal(res.rows[5].rawFields.Value, 'NA');
  assert.equal(res.rows[6].rawFields.Timestamp, '');
  assert.equal(res.rows[13].rowIndex, 14);
});

test('parseRawTextToSourceRows handles quoted CSV cells, tabs, and semicolons', () => {
  const quotedCsv = `Timestamp,Station_Zone,Pollutant,Value,Unit,Notes\n2026-11-14 08:00,"Sector 12, Dwarka",PM2.5,112,ug/m3,"Dust, construction"`;
  const csvRes = parseRawTextToSourceRows(quotedCsv);
  assert.equal(csvRes.detectedFormat, 'CSV Table');
  assert.equal(csvRes.rows[0].rawFields.Station_Zone, 'Sector 12, Dwarka');
  assert.equal(csvRes.rows[0].rawFields.Notes, 'Dust, construction');

  const semiRes = parseRawTextToSourceRows(
    `Timestamp;Station;Pollutant;Value;Unit\n2026-11-14 09:00;Ward 7;NO2;35;ppb`
  );
  assert.equal(semiRes.detectedFormat, 'Semicolon-Separated Table');
  assert.equal(semiRes.rows[0].rawFields.Station, 'Ward 7');

  const tsvRes = parseRawTextToSourceRows(
    `Timestamp\tStation\tPollutant\tValue\tUnit\n2026-11-14 10:00\tWard 8\tCO\t1.5\tppm`
  );
  assert.equal(tsvRes.detectedFormat, 'Tab-Separated Table');
  assert.equal(tsvRes.rows[0].rawFields.Value, '1.5');
});

test('parseRawTextToSourceRows handles pipe-separated markdown tables and ignores divider rows', () => {
  const md = `| Timestamp | Station | Pollutant | Value | Unit |
| --- | --- | --- | --- | --- |
| 14/11/2026 08:00 | Ward 5 | PM2.5 | 145 | ug/m3 |
| 14/11/2026 09:00 | Ward 5 | NO2 | 40 | ppb |`;

  const res = parseRawTextToSourceRows(md);
  assert.equal(res.detectedFormat, 'Pipe / Markdown Table');
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].rawFields.Station, 'Ward 5');
  assert.equal(res.rows[1].rawFields.Unit, 'ppb');
});

test('parseRawTextToSourceRows handles unstructured logs and enforces 150-row cap', () => {
  const lines = Array.from({ length: 165 }, (_, i) => `Sensor reading line ${i + 1}: PM2.5=${50 + i}`);
  const res = parseRawTextToSourceRows(lines.join('\n'));
  assert.equal(res.detectedFormat, 'Unstructured Sensor Log');
  assert.equal(res.rows.length, 150);
  assert.equal(res.truncatedCount, 15);
  assert.equal(res.rows[149].rowIndex, 150);
});

test('parseFileToSourceRows parses binary .xlsx Excel spreadsheets lazily via SheetJS', async () => {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Timestamp', 'Station', 'Pollutant', 'Value', 'Unit'],
    ['2026-11-14 07:30', 'Civil Lines', 'PM2.5', '185', 'ug/m3'],
    ['2026-11-14 08:00', 'Civil Lines', 'PM10', 'NA', 'ug/m3'],
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, 'Readings');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const file = new File([buf], 'ward_readings.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseFileToSourceRows(file);
  assert.equal(parsed.detectedFormat, 'Excel Workbook (Readings)');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].rawFields.Station, 'Civil Lines');
  assert.equal(parsed.rows[1].rawFields.Value, 'NA');
});
