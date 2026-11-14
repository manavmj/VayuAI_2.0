import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSY_TEST_FIXTURE, parseRawTextToSourceRows } from '../src/utils/parser.ts';

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
