import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActionItem,
  AdvisoryLanguage,
  CitizenAdvisory,
  ComparisonResult,
  InternalBriefing,
  NormalizationResult,
  ReadingLevel,
  SavedBriefSnapshot,
  SourceRow,
  UserRole,
} from '../types/vayu.ts';
import { apiFetch } from '../utils/authClient.ts';
import { deleteSavedBrief, loadSavedBriefs, saveBriefSnapshot } from '../utils/naqi.ts';
import { MESSY_TEST_FIXTURE, parseRawTextToSourceRows } from '../utils/parser.ts';

interface CachedBriefPair {
  internalBriefing: InternalBriefing;
  citizenAdvisory: CitizenAdvisory;
}

function getDatasetFingerprint(norm: NormalizationResult): string {
  return `${norm.datasetTitle}::${norm.totalSourceRows}::${norm.validCount}::${norm.gapCount}::${norm.anomalyCount}::${norm.overallNaqi ?? 'na'}`;
}

export function useBriefingStudio(initialRole: UserRole = 'ward_officer') {
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
  const [role, setRole] = useState<UserRole>(initialRole);
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

  // In-memory session cache & AbortControllers to avoid duplicate Gemini round-trips and stale races
  const briefCacheRef = useRef<Map<string, CachedBriefPair>>(new Map());
  const advisoryCacheRef = useRef<Map<string, CitizenAdvisory>>(new Map());
  const matrixCacheRef = useRef<Map<string, Record<UserRole, ActionItem[]>>>(new Map());
  const normalizeAbortRef = useRef<AbortController | null>(null);
  const briefAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSavedSnapshots(loadSavedBriefs());
    return () => {
      normalizeAbortRef.current?.abort();
      briefAbortRef.current?.abort();
    };
  }, []);

  const updateParsedInput = useCallback(
    (payload: {
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
      briefCacheRef.current.clear();
      advisoryCacheRef.current.clear();
      matrixCacheRef.current.clear();
    },
    []
  );

  const runNormalizationForRows = useCallback(
    async (rowsToUse: SourceRow[], titleToUse: string): Promise<NormalizationResult | null> => {
      if (rowsToUse.length === 0) return null;
      normalizeAbortRef.current?.abort();
      const controller = new AbortController();
      normalizeAbortRef.current = controller;

      setIsNormalizing(true);
      setApiError(null);

      try {
        const response = await apiFetch('/api/normalize', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            sourceRows: rowsToUse,
            datasetTitle: titleToUse.trim() || undefined,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Normalization failed.');
        }

        const normalized = data as NormalizationResult;
        setNormalization(normalized);
        setInternalBriefing(null);
        setCitizenAdvisory(null);
        setAllRolesMatrix(null);
        setComparisonResult(null);
        setIsSnapshotSaved(false);
        briefCacheRef.current.clear();
        advisoryCacheRef.current.clear();
        matrixCacheRef.current.clear();
        return normalized;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return null;
        }
        setApiError(err instanceof Error ? err.message : 'Unable to normalize dataset.');
        return null;
      } finally {
        setIsNormalizing(false);
      }
    },
    []
  );

  const loadFixtureAndNormalize = useCallback(async (): Promise<NormalizationResult | null> => {
    const parsed = parseRawTextToSourceRows(MESSY_TEST_FIXTURE);
    const title = 'Delhi Multi-Ward Morning Log (Messy Fixture)';
    updateParsedInput({
      rawText: MESSY_TEST_FIXTURE,
      rows: parsed.rows,
      detectedFormat: parsed.detectedFormat,
      truncatedCount: parsed.truncatedCount,
      suggestedTitle: title,
    });
    return runNormalizationForRows(parsed.rows, title);
  }, [runNormalizationForRows, updateParsedInput]);

  const generateBriefs = useCallback(
    async (
      targetNorm: NormalizationResult,
      targetRole: UserRole,
      targetLang: AdvisoryLanguage,
      targetLevel: ReadingLevel
    ) => {
      const fingerprint = getDatasetFingerprint(targetNorm);
      const cacheKey = `${fingerprint}::${targetRole}::${targetLang}::${targetLevel}`;
      const cached = briefCacheRef.current.get(cacheKey);
      if (cached) {
        setInternalBriefing(cached.internalBriefing);
        setCitizenAdvisory(cached.citizenAdvisory);
        setIsSnapshotSaved(false);
        return;
      }

      briefAbortRef.current?.abort();
      const controller = new AbortController();
      briefAbortRef.current = controller;

      setIsLoadingBrief(true);
      setApiError(null);
      try {
        const response = await apiFetch('/api/brief', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            normalization: targetNorm,
            role: targetRole,
            language: targetLang,
            readingLevel: targetLevel,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate briefings.');
        }

        const pair: CachedBriefPair = {
          internalBriefing: data.internalBriefing as InternalBriefing,
          citizenAdvisory: data.citizenAdvisory as CitizenAdvisory,
        };
        briefCacheRef.current.set(cacheKey, pair);
        advisoryCacheRef.current.set(
          `${fingerprint}::${targetLang}::${targetLevel}`,
          pair.citizenAdvisory
        );
        setInternalBriefing(pair.internalBriefing);
        setCitizenAdvisory(pair.citizenAdvisory);
        setIsSnapshotSaved(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setApiError(err instanceof Error ? err.message : 'Unable to generate briefings.');
      } finally {
        setIsLoadingBrief(false);
      }
    },
    []
  );

  const generateAllRoles = useCallback(async () => {
    if (!normalization) return;
    const fingerprint = getDatasetFingerprint(normalization);
    const cached = matrixCacheRef.current.get(fingerprint);
    if (cached) {
      setAllRolesMatrix(cached);
      return;
    }

    setIsLoadingAllRoles(true);
    setApiError(null);
    try {
      const response = await apiFetch('/api/brief-all-roles', {
        method: 'POST',
        body: JSON.stringify({ normalization }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to build 3-role matrix.');
      }
      const matrix = data as Record<UserRole, ActionItem[]>;
      matrixCacheRef.current.set(fingerprint, matrix);
      setAllRolesMatrix(matrix);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to generate 3-role matrix.');
    } finally {
      setIsLoadingAllRoles(false);
    }
  }, [normalization]);

  const updateAdvisorySettings = useCallback(
    async (nextLang: AdvisoryLanguage, nextLevel: ReadingLevel) => {
      setLanguage(nextLang);
      setReadingLevel(nextLevel);
      if (!normalization) return;

      const fingerprint = getDatasetFingerprint(normalization);
      const advKey = `${fingerprint}::${nextLang}::${nextLevel}`;
      const cached = advisoryCacheRef.current.get(advKey);
      if (cached) {
        setCitizenAdvisory(cached);
        setIsSnapshotSaved(false);
        return;
      }

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
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update Citizen Advisory.');
        }
        const advisory = data as CitizenAdvisory;
        advisoryCacheRef.current.set(advKey, advisory);
        setCitizenAdvisory(advisory);
        setIsSnapshotSaved(false);
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Unable to update Citizen Advisory.');
      } finally {
        setIsUpdatingAdvisory(false);
      }
    },
    [internalBriefing, normalization]
  );

  const saveSnapshot = useCallback(() => {
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
  }, [citizenAdvisory, internalBriefing, normalization, role, sourceRows]);

  const removeSnapshot = useCallback((id: string) => {
    const updated = deleteSavedBrief(id);
    setSavedSnapshots(updated);
  }, []);

  const runComparison = useCallback(
    async (previousLabel: string, previousContent: string) => {
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
        if (!response.ok) {
          throw new Error(data.error || 'Comparison failed.');
        }
        setComparisonResult(data as ComparisonResult);
      } catch (err) {
        setCompareError(err instanceof Error ? err.message : 'Unable to compare baselines.');
      } finally {
        setIsComparing(false);
      }
    },
    [normalization]
  );

  return {
    datasetTitle,
    setDatasetTitle,
    rawInputText,
    sourceRows,
    detectedFormat,
    truncatedCount,
    normalization,
    isNormalizing,
    apiError,
    role,
    setRole,
    language,
    setLanguage,
    readingLevel,
    internalBriefing,
    citizenAdvisory,
    allRolesMatrix,
    isLoadingAllRoles,
    isLoadingBrief,
    isUpdatingAdvisory,
    isSnapshotSaved,
    savedSnapshots,
    comparisonResult,
    isComparing,
    compareError,
    updateParsedInput,
    runNormalizationForRows,
    loadFixtureAndNormalize,
    generateBriefs,
    generateAllRoles,
    updateAdvisorySettings,
    saveSnapshot,
    removeSnapshot,
    runComparison,
  };
}
