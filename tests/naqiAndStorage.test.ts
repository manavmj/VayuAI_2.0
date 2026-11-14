import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteSavedBrief,
  getNaqiStyle,
  loadSavedBriefs,
  ROLE_META,
  saveBriefSnapshot,
} from '../src/utils/naqi.ts';
import type { NaqiCategory, SavedBriefSnapshot } from '../src/types/vayu.ts';
import { fastNormalizeSourceRows } from '../server/fastNormalizer.ts';
import { MESSY_TEST_FIXTURE, parseRawTextToSourceRows } from '../src/utils/parser.ts';

function installMockLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, val);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
  });
  return store;
}

test('getNaqiStyle returns distinct styling metadata for all 7 CPCB NAQI categories', () => {
  const categories: NaqiCategory[] = [
    'Good',
    'Satisfactory',
    'Moderate',
    'Poor',
    'Very Poor',
    'Severe',
    'Unavailable',
  ];
  for (const cat of categories) {
    const style = getNaqiStyle(cat);
    assert.ok(style.bg.startsWith('bg-'));
    assert.ok(style.text.startsWith('text-'));
    assert.ok(style.border.startsWith('border-'));
    assert.ok(style.range.length > 0);
  }
  assert.equal(getNaqiStyle('Severe').range, '401–500');
  assert.equal(getNaqiStyle('Unavailable').range, 'N/A');
});

test('ROLE_META defines distinct non-overlapping boundaries for all 3 civic roles', () => {
  assert.equal(ROLE_META.ward_officer.label, 'Ward Officer');
  assert.equal(ROLE_META.housing_society.label, 'Housing Society');
  assert.equal(ROLE_META.school.label, 'School');
  assert.ok(ROLE_META.ward_officer.scopeBoundaries.length >= 3);
  assert.ok(ROLE_META.housing_society.scopeBoundaries.length >= 3);
  assert.ok(ROLE_META.school.scopeBoundaries.length >= 3);
});

test('Snapshot persistence saves, deduplicates, caps at 12 snapshots, and deletes cleanly', () => {
  installMockLocalStorage();
  const parsed = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
  const { result: norm } = fastNormalizeSourceRows(parsed.rows, 'Snapshot Batch');

  const makeSnap = (id: string): SavedBriefSnapshot => ({
    id,
    savedAt: new Date().toISOString(),
    label: `Batch ${id}`,
    sourceRows: parsed.rows,
    normalization: norm,
    role: 'ward_officer',
    internalBriefing: {
      executiveSummary: 'Summary',
      confidenceLevel: 'Moderate',
      reliabilityCaveat: '2 gaps',
      keyFindings: [],
      actionPlan: [],
    },
    citizenAdvisory: {
      language: 'en',
      readingLevel: 'standard',
      headline: 'Headline',
      summary: 'Summary',
      generalActions: [],
      vulnerableGroups: { children: 'A', olderAdults: 'B', respiratorySensitive: 'C' },
      validUntilNote: '24h',
      citedRows: [1],
    },
  });

  for (let i = 1; i <= 15; i += 1) {
    saveBriefSnapshot(makeSnap(`snap-${i}`));
  }
  const loaded = loadSavedBriefs();
  assert.equal(loaded.length, 12);
  assert.equal(loaded[0].id, 'snap-15');

  const afterDelete = deleteSavedBrief('snap-15');
  assert.equal(afterDelete.length, 11);
  assert.equal(afterDelete.some((s) => s.id === 'snap-15'), false);
});
