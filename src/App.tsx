import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type {
  ActionItem,
  AdvisoryLanguage,
  AuthUser,
  CitizenAdvisory,
  ComparisonResult,
  InternalBriefing,
  NormalizationResult,
  PawanNavAction,
  ReadingLevel,
  SavedBriefSnapshot,
  SourceRow,
  UserRole,
  WorkspaceStep,
} from './types/vayu.ts';
import { deleteSavedBrief, loadSavedBriefs, saveBriefSnapshot } from './utils/naqi.ts';
import {
  apiFetch,
  fetchCurrentSessionUser,
  scrubLegacyInsecureStorage,
  setSessionToken,
} from './utils/authClient.ts';
import { MESSY_TEST_FIXTURE, parseRawTextToSourceRows } from './utils/parser.ts';
import { TopBar } from './components/TopBar.tsx';
import { LandingStep } from './components/LandingStep.tsx';
import { AuthStep } from './components/AuthStep.tsx';
import { IngestStep } from './components/IngestStep.tsx';
import { HygieneStep } from './components/HygieneStep.tsx';
import { BriefsStep } from './components/BriefsStep.tsx';
import { CompareStep } from './components/CompareStep.tsx';
import { CitationDrawer } from './components/CitationDrawer.tsx';
import { PawanAssistant } from './components/PawanAssistant.tsx';

const ZOOM_CLASS_MAP: Record<number, string> = {
  85: '[zoom:0.85]',
  95: '[zoom:0.95]',
  100: '[zoom:1]',
  110: '[zoom:1.1]',
  120: '[zoom:1.2]',
  130: '[zoom:1.3]',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WorkspaceStep>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [authInitialRole, setAuthInitialRole] = useState<UserRole>('ward_officer');
  const [zoomPct, setZoomPct] = useState<number>(100);

  // Step 1: Ingest state (strictly empty on load — no mock data)
  const [datasetTitle, setDatasetTitle] = useState('');
  const [rawInputText, setRawInputText] = useState('');
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [detectedFormat, setDetectedFormat] = useState('empty');
  const [truncatedCount, setTruncatedCount] = useState(0);

  // Step 2: Hygiene & Normalization state
  const [normalization, setNormalization] = useState<NormalizationResult | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Step 3: Briefs & Multilingual Advisory state
  const [role, setRole] = useState<UserRole>(currentUser?.role || 'ward_officer');
  const [language, setLanguage] = useState<AdvisoryLanguage>('en');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('standard');
  const [internalBriefing, setInternalBriefing] = useState<InternalBriefing | null>(null);
  const [citizenAdvisory, setCitizenAdvisory] = useState<CitizenAdvisory | null>(null);
  const [allRolesMatrix, setAllRolesMatrix] = useState<Record<UserRole, ActionItem[]> | null>(null);
  const [isLoadingAllRoles, setIsLoadingAllRoles] = useState(false);
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [isUpdatingAdvisory, setIsUpdatingAdvisory] = useState(false);
  const [isSnapshotSaved, setIsSnapshotSaved] = useState(false);

  // Step 4: Compare state
  const [savedSnapshots, setSavedSnapshots] = useState<SavedBriefSnapshot[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Traceability Inspector Drawer
  const [inspectedRows, setInspectedRows] = useState<number[] | null>(null);
  const [inspectedTitle, setInspectedTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSavedSnapshots(loadSavedBriefs());
    scrubLegacyInsecureStorage();
    void fetchCurrentSessionUser().then((verifiedUser) => {
      if (verifiedUser) {
        setCurrentUser(verifiedUser);
        setRole(verifiedUser.role);
      }
    });
  }, []);

  const handleSessionExpired = useCallback((message?: string) => {
    setSessionToken(null);
    setCurrentUser(null);
    setSessionNotice(
      message || 'Your session expired or could not be verified. Please sign in again.'
    );
    setActiveStep('auth');
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register', targetRole: UserRole = 'ward_officer') => {
    setSessionNotice(null);
    setAuthInitialMode(mode);
    setAuthInitialRole(targetRole);
    setActiveStep('auth');
  };

  const handleAuthenticated = (user: AuthUser) => {
    setSessionNotice(null);
    setCurrentUser(user);
    setRole(user.role);
    setActiveStep('ingest');
  };

  const handleLogout = () => {
    setSessionToken(null);
    setCurrentUser(null);
    setActiveStep('landing');
    void apiFetch('/api/auth/logout', { method: 'POST' });
  };

  const navigateSafely = (step: WorkspaceStep) => {
    if (!currentUser && step !== 'landing' && step !== 'auth') {
      setActiveStep('auth');
      return;
    }
    setActiveStep(step);
  };

  const handleUpdateParsedInput = (payload: {
    rawText: string;
    rows: SourceRow[];
    detectedFormat: string;
    truncatedCount: number;
    suggestedTitle?: string;
  }) => {
    setRawInputText(payload.rawText);
    setSourceRows(payload.rows);
    setDetectedFormat(payload.detectedFormat);
    setTruncatedCount(payload.truncatedCount);
    if (payload.suggestedTitle !== undefined) {
      setDatasetTitle(payload.suggestedTitle);
    }
    setApiError(null);
    setNormalization(null);
    setInternalBriefing(null);
    setCitizenAdvisory(null);
    setAllRolesMatrix(null);
    setComparisonResult(null);
    setIsSnapshotSaved(false);
  };

  const runNormalizationForRows = useCallback(
    async (rowsToUse: SourceRow[], titleToUse: string) => {
      if (rowsToUse.length === 0) return;
      setIsNormalizing(true);
      setApiError(null);

      try {
        const response = await apiFetch('/api/normalize', {
          method: 'POST',
          body: JSON.stringify({
            sourceRows: rowsToUse,
            datasetTitle: titleToUse.trim() || undefined,
          }),
        });
        const data = await response.json();
        if (response.status === 401) {
          handleSessionExpired(data.error);
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || 'Normalization failed.');
        }

        setNormalization(data as NormalizationResult);
        setInternalBriefing(null);
        setCitizenAdvisory(null);
        setAllRolesMatrix(null);
        setComparisonResult(null);
        setIsSnapshotSaved(false);
        setActiveStep('hygiene');
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Unable to normalize dataset.');
      } finally {
        setIsNormalizing(false);
      }
    },
    [handleSessionExpired]
  );

  const handleNormalize = () => {
    void runNormalizationForRows(sourceRows, datasetTitle);
  };

  const handleLoadFixtureAndAudit = async () => {
    if (!currentUser) {
      handleOpenAuth('login', 'ward_officer');
      return;
    }
    const parsed = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
    const title = 'Delhi Multi-Ward Morning Log (Messy Fixture)';
    handleUpdateParsedInput({
      rawText: MESSY_TEST_FIXTURE,
      rows: parsed.rows,
      detectedFormat: parsed.detectedFormat,
      truncatedCount: parsed.truncatedCount,
      suggestedTitle: title,
    });
    await runNormalizationForRows(parsed.rows, title);
  };

  const generateBriefs = useCallback(
    async (
      targetNorm: NormalizationResult,
      targetRole: UserRole,
      targetLang: AdvisoryLanguage,
      targetLevel: ReadingLevel
    ) => {
      setIsLoadingBrief(true);
      setApiError(null);
      try {
        const response = await apiFetch('/api/brief', {
          method: 'POST',
          body: JSON.stringify({
            normalization: targetNorm,
            role: targetRole,
            language: targetLang,
            readingLevel: targetLevel,
          }),
        });
        const data = await response.json();
        if (response.status === 401) {
          handleSessionExpired(data.error);
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate briefings.');
        }

        setInternalBriefing(data.internalBriefing as InternalBriefing);
        setCitizenAdvisory(data.citizenAdvisory as CitizenAdvisory);
        setIsSnapshotSaved(false);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Unable to generate briefings.');
      } finally {
        setIsLoadingBrief(false);
      }
    },
    [handleSessionExpired]
  );

  const handleGenerateAllRoles = async () => {
    if (!normalization) return;
    setIsLoadingAllRoles(true);
    setApiError(null);
    try {
      const response = await apiFetch('/api/brief-all-roles', {
        method: 'POST',
        body: JSON.stringify({ normalization }),
      });
      const data = await response.json();
      if (response.status === 401) {
        handleSessionExpired(data.error);
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to build 3-role matrix.');
      }
      setAllRolesMatrix(data as Record<UserRole, ActionItem[]>);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to generate 3-role matrix.');
    } finally {
      setIsLoadingAllRoles(false);
    }
  };

  const handleProceedToBriefs = async () => {
    if (!currentUser) {
      handleOpenAuth('login', role);
      return;
    }
    if (!normalization) {
      setActiveStep('briefs');
      return;
    }
    setActiveStep('briefs');
    if (!internalBriefing || !citizenAdvisory) {
      await generateBriefs(normalization, role, language, readingLevel);
    }
  };

  const handleChangeRole = async (nextRole: UserRole) => {
    setRole(nextRole);
    if (!normalization) return;
    await generateBriefs(normalization, nextRole, language, readingLevel);
  };

  const handleUpdateAdvisorySettings = async (
    nextLang: AdvisoryLanguage,
    nextLevel: ReadingLevel
  ) => {
    setLanguage(nextLang);
    setReadingLevel(nextLevel);
    if (!normalization) return;

    setIsUpdatingAdvisory(true);
    setApiError(null);
    try {
      const response = await apiFetch('/api/advisory', {
        method: 'POST',
        body: JSON.stringify({
          normalization,
          internalBriefing,
          language: nextLang,
          readingLevel: nextLevel,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        handleSessionExpired(data.error);
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update Citizen Advisory.');
      }
      setCitizenAdvisory(data as CitizenAdvisory);
      setIsSnapshotSaved(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to update Citizen Advisory.');
    } finally {
      setIsUpdatingAdvisory(false);
    }
  };

  const handleGlobalLanguageChange = (nextLang: AdvisoryLanguage) => {
    if (normalization && citizenAdvisory) {
      void handleUpdateAdvisorySettings(nextLang, readingLevel);
    } else {
      setLanguage(nextLang);
    }
  };

  const handleSaveSnapshot = () => {
    if (!normalization || !internalBriefing || !citizenAdvisory) return;
    const snapshot: SavedBriefSnapshot = {
      id: `vayu-${Date.now()}`,
      savedAt: new Date().toISOString(),
      label: `${normalization.datasetTitle} (${role.replace('_', ' ')})`,
      sourceRows,
      normalization,
      role,
      internalBriefing,
      citizenAdvisory,
    };
    const updated = saveBriefSnapshot(snapshot);
    setSavedSnapshots(updated);
    setIsSnapshotSaved(true);
  };

  const handleDeleteSnapshot = (id: string) => {
    const updated = deleteSavedBrief(id);
    setSavedSnapshots(updated);
  };

  const handleRunComparison = async (previousLabel: string, previousContent: string) => {
    if (!normalization) return;
    setIsComparing(true);
    setCompareError(null);
    try {
      const response = await apiFetch('/api/compare', {
        method: 'POST',
        body: JSON.stringify({
          currentNormalization: normalization,
          previousLabel,
          previousContent,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        handleSessionExpired(data.error);
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || 'Comparison failed.');
      }
      setComparisonResult(data as ComparisonResult);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Unable to compare baselines.');
    } finally {
      setIsComparing(false);
    }
  };

  const handleInspectRows = (rows: number[], title?: string) => {
    setInspectedRows(rows);
    setInspectedTitle(title);
  };

  const handleJumpToRoleFromLanding = async (targetRole: UserRole) => {
    if (!currentUser) {
      handleOpenAuth('login', targetRole);
      return;
    }
    setRole(targetRole);
    if (normalization) {
      setActiveStep('briefs');
      await generateBriefs(normalization, targetRole, language, readingLevel);
    } else {
      setActiveStep('ingest');
    }
  };

  const handlePawanNavAction = async (action: PawanNavAction) => {
    if (action.targetLanguage) {
      handleGlobalLanguageChange(action.targetLanguage);
    }
    if (action.targetRole) {
      setRole(action.targetRole);
    }
    if (!currentUser && action.targetPage !== 'landing' && action.targetPage !== 'auth') {
      handleOpenAuth('login', action.targetRole || 'ward_officer');
      return;
    }
    if (action.loadFixture && currentUser) {
      await handleLoadFixtureAndAudit();
      if (action.targetPage && action.targetPage !== 'ingest' && action.targetPage !== 'hygiene') {
        setActiveStep(action.targetPage);
      }
      return;
    }

    if (action.targetPage === 'briefs' && normalization && currentUser) {
      setActiveStep('briefs');
      await generateBriefs(
        normalization,
        action.targetRole || role,
        action.targetLanguage || language,
        readingLevel
      );
      return;
    }

    navigateSafely(action.targetPage);
  };

  const getPrimaryHeaderAction = (): {
    label: string;
    disabled: boolean;
    onClick: () => void;
  } => {
    if (!currentUser) {
      return {
        label: language === 'hi' ? 'लॉगिन / पंजीकरण' : 'Login / Register',
        disabled: false,
        onClick: () => handleOpenAuth('login', 'ward_officer'),
      };
    }
    if (activeStep === 'landing') {
      return {
        label: language === 'hi' ? 'डेटा अपलोड करें' : 'Upload Air Data',
        disabled: false,
        onClick: () => navigateSafely('ingest'),
      };
    }
    if (activeStep === 'ingest') {
      return {
        label: isNormalizing ? 'Normalizing...' : 'Run Hygiene Audit',
        disabled: sourceRows.length === 0 || isNormalizing,
        onClick: handleNormalize,
      };
    }
    if (activeStep === 'hygiene') {
      return {
        label: isLoadingBrief ? 'Generating Briefs...' : 'Generate Briefs',
        disabled: !normalization || isLoadingBrief,
        onClick: handleProceedToBriefs,
      };
    }
    if (activeStep === 'briefs') {
      return {
        label: 'Compare Changes',
        disabled: !normalization,
        onClick: () => navigateSafely('compare'),
      };
    }
    return {
      label: 'New Dataset',
      disabled: false,
      onClick: () => navigateSafely('ingest'),
    };
  };

  const headerAction = getPrimaryHeaderAction();
  const zoomClass = ZOOM_CLASS_MAP[zoomPct] || '[zoom:1]';

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#131b2e]">
      <TopBar
        activeStep={activeStep}
        onSelectStep={(step) => {
          if (step === 'briefs' && normalization && (!internalBriefing || !citizenAdvisory)) {
            void handleProceedToBriefs();
          } else {
            navigateSafely(step);
          }
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        hasNormalizedData={Boolean(normalization)}
        onPrimaryAction={headerAction.onClick}
        primaryActionLabel={headerAction.label}
        primaryActionDisabled={headerAction.disabled}
        language={language}
        onChangeLanguage={handleGlobalLanguageChange}
        zoomPct={zoomPct}
        onChangeZoom={setZoomPct}
        datasetTitle={normalization?.datasetTitle}
      />

      <main className={`mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 sm:px-8 ${zoomClass}`}>
        {apiError && activeStep !== 'ingest' && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6]/50 px-4 py-3 text-sm text-[#93000a]"
          >
            <span className="font-semibold">Action Error: </span>
            {apiError}
          </div>
        )}

        {activeStep === 'landing' && (
          <LandingStep
            language={language}
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            onStartIngest={() => navigateSafely('ingest')}
            onLoadFixtureAndAudit={handleLoadFixtureAndAudit}
            onJumpToRole={handleJumpToRoleFromLanding}
            isProcessingFixture={isNormalizing}
          />
        )}

        {activeStep === 'auth' && (
          <AuthStep
            initialMode={authInitialMode}
            initialRole={authInitialRole}
            language={language}
            sessionNotice={sessionNotice}
            onAuthenticated={handleAuthenticated}
            onBackHome={() => setActiveStep('landing')}
          />
        )}

        {currentUser && activeStep === 'ingest' && (
          <IngestStep
            datasetTitle={datasetTitle}
            onChangeTitle={setDatasetTitle}
            rawInputText={rawInputText}
            sourceRows={sourceRows}
            detectedFormat={detectedFormat}
            truncatedCount={truncatedCount}
            onUpdateParsedInput={handleUpdateParsedInput}
            onNormalize={handleNormalize}
            isNormalizing={isNormalizing}
            errorMessage={apiError}
          />
        )}

        {currentUser && activeStep === 'hygiene' && (
          <HygieneStep
            normalization={normalization}
            onInspectRows={handleInspectRows}
            onProceedToBriefs={handleProceedToBriefs}
            onGoToIngest={() => navigateSafely('ingest')}
            isGeneratingBriefs={isLoadingBrief}
          />
        )}

        {currentUser && activeStep === 'briefs' && (
          <BriefsStep
            normalization={normalization}
            role={role}
            onChangeRole={handleChangeRole}
            internalBriefing={internalBriefing}
            citizenAdvisory={citizenAdvisory}
            allRolesMatrix={allRolesMatrix}
            isLoadingAllRoles={isLoadingAllRoles}
            onGenerateAllRoles={handleGenerateAllRoles}
            language={language}
            readingLevel={readingLevel}
            onUpdateAdvisorySettings={handleUpdateAdvisorySettings}
            isLoadingBrief={isLoadingBrief}
            isUpdatingAdvisory={isUpdatingAdvisory}
            onInspectRows={handleInspectRows}
            onSaveSnapshot={handleSaveSnapshot}
            isSnapshotSaved={isSnapshotSaved}
            onProceedToCompare={() => navigateSafely('compare')}
            onGoToIngest={() => navigateSafely('ingest')}
          />
        )}

        {currentUser && activeStep === 'compare' && (
          <CompareStep
            currentNormalization={normalization}
            savedSnapshots={savedSnapshots}
            onDeleteSnapshot={handleDeleteSnapshot}
            onRunComparison={handleRunComparison}
            comparisonResult={comparisonResult}
            isComparing={isComparing}
            compareError={compareError}
            onInspectRows={handleInspectRows}
            onGoToIngest={() => navigateSafely('ingest')}
          />
        )}
      </main>

      {/* Footer with Explicit WHO 2021 Guidelines & CPCB Reference Links */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-8 no-print">
        <div className="mx-auto max-w-[1360px] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-[#16a34a]/20 bg-[#f0fdf4]/70 px-5 py-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
                {language === 'hi'
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
        sourceRows={sourceRows}
        readings={normalization?.readings || []}
        contextTitle={inspectedTitle}
        onClose={() => setInspectedRows(null)}
      />

      <PawanAssistant
        activeStep={activeStep}
        isAuthenticated={Boolean(currentUser)}
        hasData={sourceRows.length > 0}
        normalization={normalization}
        language={language}
        onExecuteNavAction={(action) => void handlePawanNavAction(action)}
      />
    </div>
  );
}
