import React, { Suspense, useCallback, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { AdvisoryLanguage, PawanNavAction, UserRole, WorkspaceStep } from './types/vayu.ts';
import { useAuthSession } from './hooks/useAuthSession.ts';
import { useBriefingStudio } from './hooks/useBriefingStudio.ts';
import { TopBar } from './components/TopBar.tsx';
import { LandingStep } from './components/LandingStep.tsx';
import { CitationDrawer } from './components/CitationDrawer.tsx';
import { PawanAssistant } from './components/PawanAssistant.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Code-split heavy workflow views (SheetJS, Recharts, Compare, Auth) for fast initial paint
const AuthStep = React.lazy(() =>
  import('./components/AuthStep.tsx').then((m) => ({ default: m.AuthStep }))
);
const IngestStep = React.lazy(() =>
  import('./components/IngestStep.tsx').then((m) => ({ default: m.IngestStep }))
);
const HygieneStep = React.lazy(() =>
  import('./components/HygieneStep.tsx').then((m) => ({ default: m.HygieneStep }))
);
const BriefsStep = React.lazy(() =>
  import('./components/BriefsStep.tsx').then((m) => ({ default: m.BriefsStep }))
);
const CompareStep = React.lazy(() =>
  import('./components/CompareStep.tsx').then((m) => ({ default: m.CompareStep }))
);

const ZOOM_CLASS_MAP: Record<number, string> = {
  85: '[zoom:0.85]',
  95: '[zoom:0.95]',
  100: '[zoom:1]',
  110: '[zoom:1.1]',
  120: '[zoom:1.2]',
  130: '[zoom:1.3]',
};

const StepLoadingFallback: React.FC = () => (
  <div
    aria-busy="true"
    aria-label="Loading workspace view"
    className="rounded-2xl border border-slate-200 bg-white p-10 space-y-4 animate-pulse"
  >
    <div className="h-5 w-44 rounded bg-[#f0fdf4]" />
    <div className="h-8 w-80 rounded bg-slate-100" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
      <div className="h-28 rounded-xl bg-slate-100" />
      <div className="h-28 rounded-xl bg-slate-100" />
      <div className="h-28 rounded-xl bg-slate-100" />
    </div>
  </div>
);

export default function App() {
  const [activeStep, setActiveStep] = useState<WorkspaceStep>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [authInitialRole, setAuthInitialRole] = useState<UserRole>('ward_officer');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [inspectedRows, setInspectedRows] = useState<number[] | null>(null);
  const [inspectedTitle, setInspectedTitle] = useState<string | undefined>(undefined);

  const studio = useBriefingStudio('ward_officer');
  const { setRole } = studio;

  const syncUserRole = useCallback(
    (userRole: UserRole) => {
      setRole(userRole);
    },
    [setRole]
  );

  const auth = useAuthSession(syncUserRole);

  const handleOpenAuth = useCallback(
    (mode: 'login' | 'register' = 'login', targetRole: UserRole = 'ward_officer') => {
      auth.clearSessionNotice();
      setAuthInitialMode(mode);
      setAuthInitialRole(targetRole);
      setActiveStep('auth');
    },
    [auth]
  );

  const handleNormalize = useCallback(async () => {
    const normalized = await studio.runNormalizationForRows(studio.sourceRows, studio.datasetTitle);
    if (normalized) {
      setActiveStep('hygiene');
    }
  }, [studio]);

  const handleLoadFixtureAndAudit = useCallback(async () => {
    const normalized = await studio.loadFixtureAndNormalize();
    if (normalized) {
      setActiveStep('hygiene');
    }
  }, [studio]);

  const handleProceedToBriefs = useCallback(async () => {
    setActiveStep('briefs');
    if (studio.normalization && (!studio.internalBriefing || !studio.citizenAdvisory)) {
      await studio.generateBriefs(
        studio.normalization,
        studio.role,
        studio.language,
        studio.readingLevel
      );
    }
  }, [studio]);

  const handleChangeRole = useCallback(
    async (nextRole: UserRole) => {
      studio.setRole(nextRole);
      if (!studio.normalization) return;
      await studio.generateBriefs(
        studio.normalization,
        nextRole,
        studio.language,
        studio.readingLevel
      );
    },
    [studio]
  );

  const handleGlobalLanguageChange = useCallback(
    (nextLang: AdvisoryLanguage) => {
      if (studio.normalization && studio.citizenAdvisory) {
        void studio.updateAdvisorySettings(nextLang, studio.readingLevel);
      } else {
        studio.setLanguage(nextLang);
      }
    },
    [studio]
  );

  const handleInspectRows = useCallback((rows: number[], title?: string) => {
    setInspectedRows(rows);
    setInspectedTitle(title);
  }, []);

  const handleJumpToRoleFromLanding = useCallback(
    async (targetRole: UserRole) => {
      studio.setRole(targetRole);
      if (studio.normalization) {
        setActiveStep('briefs');
        await studio.generateBriefs(
          studio.normalization,
          targetRole,
          studio.language,
          studio.readingLevel
        );
      } else {
        setActiveStep('ingest');
      }
    },
    [studio]
  );

  const handlePawanNavAction = useCallback(
    async (action: PawanNavAction) => {
      if (action.targetLanguage) {
        handleGlobalLanguageChange(action.targetLanguage);
      }
      if (action.targetRole) {
        studio.setRole(action.targetRole);
      }
      if (action.loadFixture) {
        const normalized = await studio.loadFixtureAndNormalize();
        if (normalized) {
          setActiveStep(
            action.targetPage && action.targetPage !== 'ingest' ? action.targetPage : 'hygiene'
          );
        }
        return;
      }

      if (action.targetPage === 'briefs' && studio.normalization) {
        setActiveStep('briefs');
        await studio.generateBriefs(
          studio.normalization,
          action.targetRole || studio.role,
          action.targetLanguage || studio.language,
          studio.readingLevel
        );
        return;
      }

      setActiveStep(action.targetPage);
    },
    [handleGlobalLanguageChange, studio]
  );

  const getPrimaryHeaderAction = (): {
    label: string;
    disabled: boolean;
    onClick: () => void;
  } => {
    if (activeStep === 'landing' || activeStep === 'auth') {
      return {
        label: studio.language === 'hi' ? 'डेटा अपलोड करें' : 'Upload Air Data',
        disabled: false,
        onClick: () => setActiveStep('ingest'),
      };
    }
    if (activeStep === 'ingest') {
      return {
        label: studio.isNormalizing ? 'Normalizing...' : 'Run Hygiene Audit',
        disabled: studio.sourceRows.length === 0 || studio.isNormalizing,
        onClick: () => void handleNormalize(),
      };
    }
    if (activeStep === 'hygiene') {
      return {
        label: studio.isLoadingBrief ? 'Generating Briefs...' : 'Generate Briefs',
        disabled: !studio.normalization || studio.isLoadingBrief,
        onClick: () => void handleProceedToBriefs(),
      };
    }
    if (activeStep === 'briefs') {
      return {
        label: 'Compare Changes',
        disabled: !studio.normalization,
        onClick: () => setActiveStep('compare'),
      };
    }
    return {
      label: 'New Dataset',
      disabled: false,
      onClick: () => setActiveStep('ingest'),
    };
  };

  const headerAction = getPrimaryHeaderAction();
  const zoomClass = ZOOM_CLASS_MAP[zoomPct] || '[zoom:1]';

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#131b2e]">
      <TopBar
        activeStep={activeStep}
        onSelectStep={(step) => {
          if (
            step === 'briefs' &&
            studio.normalization &&
            (!studio.internalBriefing || !studio.citizenAdvisory)
          ) {
            void handleProceedToBriefs();
          } else {
            setActiveStep(step);
          }
        }}
        currentUser={auth.currentUser}
        onOpenAuth={() => handleOpenAuth('login', studio.role)}
        onLogout={auth.handleLogout}
        hasNormalizedData={Boolean(studio.normalization)}
        onPrimaryAction={headerAction.onClick}
        primaryActionLabel={headerAction.label}
        primaryActionDisabled={headerAction.disabled}
        language={studio.language}
        onChangeLanguage={handleGlobalLanguageChange}
        zoomPct={zoomPct}
        onChangeZoom={setZoomPct}
        datasetTitle={studio.normalization?.datasetTitle}
      />

      <main className={`mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 sm:px-8 ${zoomClass}`}>
        {studio.apiError && activeStep !== 'ingest' && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6]/50 px-4 py-3 text-sm text-[#93000a]"
          >
            <span className="font-semibold">Action Error: </span>
            {studio.apiError}
          </div>
        )}

        <ErrorBoundary fallbackTitle="Workspace view encountered a rendering error">
          <Suspense fallback={<StepLoadingFallback />}>
            {activeStep === 'landing' && (
              <LandingStep
                language={studio.language}
                currentUser={auth.currentUser}
                onOpenAuth={handleOpenAuth}
                onStartIngest={() => setActiveStep('ingest')}
                onLoadFixtureAndAudit={() => void handleLoadFixtureAndAudit()}
                onJumpToRole={(r) => void handleJumpToRoleFromLanding(r)}
                isProcessingFixture={studio.isNormalizing}
              />
            )}

            {activeStep === 'auth' && (
              <AuthStep
                initialMode={authInitialMode}
                initialRole={authInitialRole}
                language={studio.language}
                sessionNotice={auth.sessionNotice}
                onAuthenticated={(user) => {
                  auth.handleAuthenticated(user);
                  setActiveStep('ingest');
                }}
                onBackHome={() => setActiveStep('landing')}
              />
            )}

            {activeStep === 'ingest' && (
              <IngestStep
                datasetTitle={studio.datasetTitle}
                onChangeTitle={studio.setDatasetTitle}
                rawInputText={studio.rawInputText}
                sourceRows={studio.sourceRows}
                detectedFormat={studio.detectedFormat}
                truncatedCount={studio.truncatedCount}
                onUpdateParsedInput={studio.updateParsedInput}
                onNormalize={() => void handleNormalize()}
                isNormalizing={studio.isNormalizing}
                errorMessage={studio.apiError}
              />
            )}

            {activeStep === 'hygiene' && (
              <HygieneStep
                normalization={studio.normalization}
                onInspectRows={handleInspectRows}
                onProceedToBriefs={() => void handleProceedToBriefs()}
                onGoToIngest={() => setActiveStep('ingest')}
                isGeneratingBriefs={studio.isLoadingBrief}
              />
            )}

            {activeStep === 'briefs' && (
              <BriefsStep
                normalization={studio.normalization}
                role={studio.role}
                onChangeRole={(r) => void handleChangeRole(r)}
                internalBriefing={studio.internalBriefing}
                citizenAdvisory={studio.citizenAdvisory}
                allRolesMatrix={studio.allRolesMatrix}
                isLoadingAllRoles={studio.isLoadingAllRoles}
                onGenerateAllRoles={() => void studio.generateAllRoles()}
                language={studio.language}
                readingLevel={studio.readingLevel}
                onUpdateAdvisorySettings={(lang, level) =>
                  void studio.updateAdvisorySettings(lang, level)
                }
                isLoadingBrief={studio.isLoadingBrief}
                isUpdatingAdvisory={studio.isUpdatingAdvisory}
                onInspectRows={handleInspectRows}
                onSaveSnapshot={studio.saveSnapshot}
                isSnapshotSaved={studio.isSnapshotSaved}
                onProceedToCompare={() => setActiveStep('compare')}
                onGoToIngest={() => setActiveStep('ingest')}
              />
            )}

            {activeStep === 'compare' && (
              <CompareStep
                currentNormalization={studio.normalization}
                savedSnapshots={studio.savedSnapshots}
                onDeleteSnapshot={studio.removeSnapshot}
                onRunComparison={studio.runComparison}
                comparisonResult={studio.comparisonResult}
                isComparing={studio.isComparing}
                compareError={studio.compareError}
                onInspectRows={handleInspectRows}
                onGoToIngest={() => setActiveStep('ingest')}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Footer with Explicit WHO 2021 Guidelines & CPCB Reference Links */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-8 no-print">
        <div className="mx-auto max-w-[1360px] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-[#16a34a]/20 bg-[#f0fdf4]/70 px-5 py-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
                {studio.language === 'hi'
                  ? 'आधिकारिक वायु गुणवत्ता मानक संदर्भ'
                  : 'Official Regulatory & Public Health Benchmarks'}
              </p>
              <p className="text-xs text-[#3f493f] font-mono tabular-nums">
                WHO 2021 24h Guidelines: PM2.5 ≤ 15 µg/m³ · PM10 ≤ 45 µg/m³ · NO2 ≤ 25 µg/m³ · SO2 ≤ 40 µg/m³ · CO ≤ 4 mg/m³
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href="https://www.who.int/publications/i/item/9789240034228"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#15803d] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#00652c] transition-colors"
              >
                <span>WHO 2021 Air Quality Guidelines</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href="https://cpcb.nic.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#16a34a]/30 bg-white px-3.5 py-2 text-xs font-semibold text-[#15803d] hover:bg-[#dcfce7] transition-colors"
              >
                <span>CPCB India NAQI</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>Vayu AI · Civic Air Quality Briefing Studio (CPCB NAQI &amp; WHO 2021)</span>
            <span>Zero-hallucination policy: missing readings remain null &amp; cited</span>
          </div>
        </div>
      </footer>

      <CitationDrawer
        selectedRowIndices={inspectedRows}
        sourceRows={studio.sourceRows}
        readings={studio.normalization?.readings || []}
        contextTitle={inspectedTitle}
        onClose={() => setInspectedRows(null)}
      />

      <PawanAssistant
        activeStep={activeStep}
        isAuthenticated={Boolean(auth.currentUser)}
        hasData={studio.sourceRows.length > 0}
        normalization={studio.normalization}
        language={studio.language}
        onExecuteNavAction={(action) => void handlePawanNavAction(action)}
      />
    </div>
  );
}
