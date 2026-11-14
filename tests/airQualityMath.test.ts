import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCpcbNaqiSubIndex, convertAirPollutant } from '../src/utils/airQualityMath.ts';

test('convertAirPollutant rejects ppm/ppb for particulate matter PM2.5 and PM10', () => {
  const res = convertAirPollutant({
    pollutant: 'PM2.5',
    inputValue: 50,
    fromUnit: 'ppb',
    toUnit: 'ug/m3',
  });
  assert.equal(res.valid, false);
  assert.match(res.unsupportedReason || '', /particulate/i);
});

test('convertAirPollutant rejects negative concentration inputs', () => {
  const res = convertAirPollutant({
    pollutant: 'NO2',
    inputValue: -12,
    fromUnit: 'ug/m3',
    toUnit: 'ppb',
  });
  assert.equal(res.valid, false);
});

test('convertAirPollutant converts NO2 ppb to ug/m3 and evaluates WHO exceedance accurately', () => {
  const res = convertAirPollutant({
    pollutant: 'NO2',
    inputValue: 48,
    fromUnit: 'ppb',
    toUnit: 'ug/m3',
    tempCelsius: 25,
  });
  assert.equal(res.valid, true);
  assert.ok(res.ugm3 !== null && res.ugm3 > 85 && res.ugm3 < 95);
  assert.equal(res.whoExceeded, true);
  assert.equal(res.naqi?.category, 'Moderate');
});

test('convertAirPollutant converts CO ppm to mg/m3 cleanly', () => {
  const res = convertAirPollutant({
    pollutant: 'CO',
    inputValue: 2.6,
    fromUnit: 'ppm',
    toUnit: 'mg/m3',
    tempCelsius: 25,
  });
  assert.equal(res.valid, true);
  assert.ok(res.mgm3 !== null && Math.abs(res.mgm3 - 2.978) < 0.05);
  assert.equal(res.whoExceeded, false);
});

test('computeCpcbNaqiSubIndex maps PM2.5 concentrations to exact CPCB NAQI categories', () => {
  assert.equal(computeCpcbNaqiSubIndex('PM2.5', 20).category, 'Good');
  assert.equal(computeCpcbNaqiSubIndex('PM2.5', 75).category, 'Moderate');
  assert.equal(computeCpcbNaqiSubIndex('PM2.5', 268).category, 'Severe');
  assert.equal(computeCpcbNaqiSubIndex('PM2.5', 600).index, 500);
});
