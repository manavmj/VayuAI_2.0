import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAiAuditCorrections,
  fastNormalizeSourceRows,
  normalizeTimestampToIso,
} from '../server/fastNormalizer.ts';
import { MESSY_TEST_FIXTURE, parseRawTextToSourceRows } from '../src/utils/parser.ts';

test('normalizeTimestampToIso handles Indian DD/MM/YYYY, DD-MMM-YY AM/PM, ISO, and blank values', () => {
  assert.equal(normalizeTimestampToIso('14/11/2026 06:30'), '2026-11-14T06:30:00+05:30');
  assert.equal(normalizeTimestampToIso('14-Nov-26 02:15 PM'), '2026-11-14T14:15:00+05:30');
  assert.equal(normalizeTimestampToIso('2026-11-14T07:15+05:30'), '2026-11-14T07:15:00+05:30');
  assert.equal(normalizeTimestampToIso(''), null);
  assert.equal(normalizeTimestampToIso('NA'), null);
});

test('fastNormalizeSourceRows normalizes 14-row MESSY_TEST_FIXTURE with zero ambiguous rows and zero imputation', () => {
  const parsed = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
  const { result, ambiguousRows } = fastNormalizeSourceRows(parsed.rows, 'Fixture Check');

  assert.equal(ambiguousRows.length, 0);
  assert.equal(result.totalSourceRows, 14);
  assert.equal(result.gapCount, 2); // Rows 6 (NA) and 7 (--)
  assert.equal(result.anomalyCount, 2); // Rows 9 (1940 spike) and 12 (-12 calibration fault)
  assert.equal(result.validCount, 10);

  const row3 = result.readings.find((r) => r.rowIndex === 3);
  assert.ok(row3);
  assert.equal(row3.pollutant, 'NO2');
  assert.equal(row3.normalizedUnit, 'ug/m3');
  assert.ok((row3.normalizedValue ?? 0) > 85 && (row3.normalizedValue ?? 0) < 95);

  const row6 = result.readings.find((r) => r.rowIndex === 6);
  assert.equal(row6?.status, 'missing');
  assert.equal(row6?.normalizedValue, null);
  assert.equal(row6?.naqiCategory, 'Unavailable');

  const row12 = result.readings.find((r) => r.rowIndex === 12);
  assert.equal(row12?.status, 'anomaly');
  assert.equal(row12?.naqiSubIndex, null);
});

test('fastNormalizeSourceRows handles wide multi-pollutant tables and unstructured field logs', () => {
  const wideCsv = `Timestamp,Station,PM2.5 (ug/m3),PM10 (ug/m3)\n2026-11-14 08:00,Station Alpha,95,-8`;
  const wideParsed = parseRawTextToSourceRows(wideCsv);
  const { result: wideNorm, ambiguousRows: wideAmb } = fastNormalizeSourceRows(wideParsed.rows);
  assert.equal(wideAmb.length, 0);
  assert.equal(wideNorm.anomalyCount, 1);
  assert.equal(wideNorm.readings[0].pollutant, 'PM10');

  const logText = `2026-11-14 09:00 station: Gate 2 PM2.5=155 ug/m3\nUnparseable sensor heartbeat ok`;
  const logParsed = parseRawTextToSourceRows(logText);
  const { result: logNorm, ambiguousRows: logAmb } = fastNormalizeSourceRows(logParsed.rows);
  assert.equal(logNorm.readings[0].status, 'valid');
  assert.equal(logNorm.readings[0].normalizedValue, 155);
  assert.equal(logAmb.length, 1);
  assert.equal(logAmb[0].rowIndex, 2);
});

test('applyAiAuditCorrections applies contextual anomaly flags while keeping deterministic counts and null gaps', () => {
  const csv = `Timestamp,Station,Pollutant,Value,Unit,Notes
2026-11-14 08:00,Zone A,PM2.5,62,ug/m3,Morning baseline
2026-11-14 08:15,Zone A,PM2.5,580,ug/m3,Sudden uncalibrated jump
2026-11-14 08:30,Zone A,PM2.5,NA,ug/m3,Dropout`;

  const parsed = parseRawTextToSourceRows(csv);
  const { result: base } = fastNormalizeSourceRows(parsed.rows, 'Zone A Log');
  assert.equal(base.anomalyCount, 0);

  const audited = applyAiAuditCorrections(
    base,
    [
      {
        rowIndex: 2,
        status: 'anomaly',
        issueNote: 'Sudden 9x jump from 62 to 580 ug/m3 flagged as uncalibrated spike.',
      },
    ],
    [
      {
        id: 'ai-spike-1',
        severity: 'outlier',
        title: '1 Contextual Sensor Spike Detected',
        explanation: 'Row 2 jumped 9x above baseline with calibration warning.',
        affectedRows: [2],
        reliabilityImpact: 'Excluded from confirmed ambient exposure.',
      },
    ]
  );

  assert.equal(audited.anomalyCount, 1);
  assert.equal(audited.gapCount, 1);
  assert.equal(audited.validCount, 1);
  assert.equal(audited.readings[1].status, 'anomaly');
  assert.equal(audited.readings[2].normalizedValue, null);
  assert.equal(audited.stationSummaries[0].anomalyCount, 1);
});
