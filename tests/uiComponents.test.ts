import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fastNormalizeSourceRows } from '../server/fastNormalizer.ts';
import { MESSY_TEST_FIXTURE, parseRawTextToSourceRows } from '../src/utils/parser.ts';

// Allow Node's ESM loader to resolve Vite static image asset imports during SSR component tests
registerHooks({
  load(url, context, nextLoad) {
    if (/\.(jpg|jpeg|png|webp|svg)$/i.test(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(path.basename(url))};`,
      };
    }
    return nextLoad(url, context);
  },
});

test('All local civic image assets referenced by src/assets/civicImages.ts exist on disk', () => {
  const imageDir = path.resolve('src/assets/images');
  const expectedFiles = [
    'hero_canopy_sunlight_1794640282489.jpg',
    'civic_ward_monitoring_1794640282835.jpg',
    'housing_society_greenery_1794640283246.jpg',
    'school_clean_air_1794640284649.jpg',
  ];
  for (const file of expectedFiles) {
    const stat = fs.statSync(path.join(imageDir, file));
    assert.ok(stat.size > 10_000, `Expected non-empty asset ${file}`);
  }
});

test('TopBar and LandingStep render all open pre-login workflows, WHO guidelines, and accessible images', async () => {
  const [{ TopBar }, { LandingStep }] = await Promise.all([
    import('../src/components/TopBar.tsx'),
    import('../src/components/LandingStep.tsx'),
  ]);

  const topBarHtml = renderToStaticMarkup(
    React.createElement(TopBar, {
      activeStep: 'landing',
      onSelectStep: () => {},
      currentUser: null,
      onOpenAuth: () => {},
      onLogout: () => {},
      hasNormalizedData: false,
      onPrimaryAction: () => {},
      primaryActionLabel: 'Upload Air Data',
      primaryActionDisabled: false,
      language: 'en',
      onChangeLanguage: () => {},
      zoomPct: 100,
      onChangeZoom: () => {},
    })
  );

  assert.match(topBarHtml, /01\. Ingest/);
  assert.match(topBarHtml, /02\. Dashboards/);
  assert.match(topBarHtml, /03\. Briefs &amp; Roles/);
  assert.match(topBarHtml, /04\. Compare/);
  assert.match(topBarHtml, /Role Login \/ Register/);
  assert.match(topBarHtml, /aria-label="Workspace Steps"/);

  const landingHtml = renderToStaticMarkup(
    React.createElement(LandingStep, {
      language: 'en',
      currentUser: null,
      onOpenAuth: () => {},
      onStartIngest: () => {},
      onLoadFixtureAndAudit: () => {},
      onJumpToRole: () => {},
      isProcessingFixture: false,
    })
  );

  assert.match(landingHtml, /Open Data Ingestion/);
  assert.match(landingHtml, /Load Messy Test Fixture &amp; Analyze/);
  assert.match(landingHtml, /WHO 2021 vs\. Indian CPCB NAQI/);
  assert.match(landingHtml, /Ward Officer/);
  assert.match(landingHtml, /Housing Society \(RWA\)/);
  assert.match(landingHtml, /School Administration/);
  assert.match(landingHtml, /hero_canopy_sunlight_1794640282489\.jpg/);
});

test('AuthStep, IngestStep, HygieneStep, BriefsStep, CompareStep, UnitConverterTool, CitationDrawer, ErrorBoundary, and PawanAssistant render cleanly', async () => {
  const [
    { AuthStep },
    { IngestStep },
    { HygieneStep },
    { BriefsStep },
    { CompareStep },
    { UnitConverterTool },
    { CitationDrawer },
    { ErrorBoundary },
    { PawanAssistant },
  ] = await Promise.all([
    import('../src/components/AuthStep.tsx'),
    import('../src/components/IngestStep.tsx'),
    import('../src/components/HygieneStep.tsx'),
    import('../src/components/BriefsStep.tsx'),
    import('../src/components/CompareStep.tsx'),
    import('../src/components/UnitConverterTool.tsx'),
    import('../src/components/CitationDrawer.tsx'),
    import('../src/components/ErrorBoundary.tsx'),
    import('../src/components/PawanAssistant.tsx'),
  ]);

  const parsed = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
  const { result: norm } = fastNormalizeSourceRows(parsed.rows, 'Delhi Fixture');

  const ingestHtml = renderToStaticMarkup(
    React.createElement(IngestStep, {
      datasetTitle: 'Test Batch',
      onChangeTitle: () => {},
      rawInputText: MESSY_TEST_FIXTURE,
      sourceRows: parsed.rows,
      detectedFormat: parsed.detectedFormat,
      truncatedCount: 0,
      onUpdateParsedInput: () => {},
      onNormalize: () => {},
      isNormalizing: false,
      errorMessage: null,
    })
  );
  assert.match(ingestHtml, /Normalize &amp; Audit Hygiene/);
  assert.match(ingestHtml, /14 indexed rows/);

  const hygieneEmptyHtml = renderToStaticMarkup(
    React.createElement(HygieneStep, {
      normalization: null,
      onInspectRows: () => {},
      onProceedToBriefs: () => {},
      onGoToIngest: () => {},
      isGeneratingBriefs: false,
    })
  );
  assert.match(hygieneEmptyHtml, /Data Quality Dashboards Awaiting Input/);

  const hygieneDataHtml = renderToStaticMarkup(
    React.createElement(HygieneStep, {
      normalization: norm,
      onInspectRows: () => {},
      onProceedToBriefs: () => {},
      onGoToIngest: () => {},
      isGeneratingBriefs: false,
    })
  );
  assert.match(hygieneDataHtml, /Delhi Fixture/);
  assert.match(hygieneDataHtml, /Anand Vihar Junction/);
  assert.match(hygieneDataHtml, /Station × Pollutant Severity &amp; Sensor Hygiene Heatmaps/);

  const briefsHtml = renderToStaticMarkup(
    React.createElement(BriefsStep, {
      normalization: norm,
      role: 'ward_officer',
      onChangeRole: () => {},
      internalBriefing: {
        executiveSummary: 'High PM2.5 across Anand Vihar and Okhla.',
        confidenceLevel: 'Moderate',
        reliabilityCaveat: '2 gaps and 2 anomalies flagged.',
        keyFindings: [{ label: 'Hotspot', claim: 'Row 1 PM2.5=268 ug/m3', citedRows: [1] }],
        actionPlan: [
          {
            priority: 'Immediate',
            title: 'Deploy road sweeping',
            rationale: 'Dust corridor elevated',
            authorityScope: 'Municipal Ward',
            citedRows: [1, 2],
          },
        ],
      },
      citizenAdvisory: {
        language: 'en',
        readingLevel: 'standard',
        headline: 'Air Quality Advisory',
        summary: 'Limit outdoor exposure near Anand Vihar.',
        generalActions: ['Wear N95 outdoors'],
        vulnerableGroups: {
          children: 'Keep play indoors.',
          olderAdults: 'Avoid morning walks.',
          respiratorySensitive: 'Keep rescue inhaler ready.',
        },
        validUntilNote: 'Next 24h',
        citedRows: [1, 2],
      },
      allRolesMatrix: null,
      isLoadingAllRoles: false,
      onGenerateAllRoles: () => {},
      language: 'en',
      readingLevel: 'standard',
      onUpdateAdvisorySettings: () => {},
      isLoadingBrief: false,
      isUpdatingAdvisory: false,
      onInspectRows: () => {},
      onSaveSnapshot: () => {},
      isSnapshotSaved: false,
      onProceedToCompare: () => {},
      onGoToIngest: () => {},
    })
  );
  assert.match(briefsHtml, /Deploy road sweeping/);
  assert.match(briefsHtml, /Air Quality Advisory/);

  const compareHtml = renderToStaticMarkup(
    React.createElement(CompareStep, {
      currentNormalization: norm,
      savedSnapshots: [],
      onDeleteSnapshot: () => {},
      onRunComparison: async () => {},
      comparisonResult: null,
      isComparing: false,
      compareError: null,
      onInspectRows: () => {},
      onGoToIngest: () => {},
    })
  );
  assert.match(compareHtml, /Run Grounded Delta Comparison/);

  const converterHtml = renderToStaticMarkup(
    React.createElement(UnitConverterTool, { language: 'en' })
  );
  assert.match(converterHtml, /Pollutant Unit Converter/);

  const authHtml = renderToStaticMarkup(
    React.createElement(AuthStep, {
      initialMode: 'login',
      initialRole: 'ward_officer',
      language: 'en',
      sessionNotice: null,
      onAuthenticated: () => {},
      onBackHome: () => {},
    })
  );
  assert.match(authHtml, /Optional Civic Role Sign-In &amp; Registration/);
  assert.match(authHtml, /Login as Ward Officer/);
  assert.match(authHtml, /scrypt/);

  const drawerHtml = renderToStaticMarkup(
    React.createElement(CitationDrawer, {
      selectedRowIndices: [1, 6],
      sourceRows: parsed.rows,
      readings: norm.readings,
      contextTitle: 'Audit Check',
      onClose: () => {},
    })
  );
  assert.match(drawerHtml, /Row #1/);
  assert.match(drawerHtml, /Row #6/);

  const pawanHtml = renderToStaticMarkup(
    React.createElement(PawanAssistant, {
      activeStep: 'landing',
      isAuthenticated: false,
      hasData: false,
      normalization: null,
      language: 'en',
      onExecuteNavAction: () => {},
    })
  );
  assert.match(pawanHtml, /Pawan/);

  const boundaryHtml = renderToStaticMarkup(
    React.createElement(ErrorBoundary, {
      fallbackTitle: 'Test Boundary',
      children: React.createElement('div', null, 'Healthy Child'),
    })
  );
  assert.match(boundaryHtml, /Healthy Child/);
});
