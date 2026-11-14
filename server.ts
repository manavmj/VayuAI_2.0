import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  applyAiAuditCorrections,
  fastNormalizeSourceRows,
  type AiRowAuditCorrection,
} from './server/fastNormalizer.ts';
import {
  authenticateAccount,
  clearFailedLogin,
  clearSessionCookie,
  createRateLimiter,
  extractAuthUser,
  isValidEmail,
  isValidRole,
  recordFailedLogin,
  registerAccount,
  requireAuth,
  sanitizeTextInput,
  securityHeadersMiddleware,
  setSessionCookie,
  signSessionToken,
  validatePasswordStrength,
  checkLoginLockout,
} from './server/security.ts';
import type {
  ActionItem,
  AdvisoryLanguage,
  AuthUser,
  CitizenAdvisory,
  ComparisonResult,
  InternalBriefing,
  NormalizationResult,
  NormalizedReading,
  PawanNavAction,
  ReadingLevel,
  SourceRow,
  UserRole,
} from './src/types/vayu.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_ID = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateJsonWithRetry<T>(params: {
  systemInstruction: string;
  contents: string;
  responseSchema: Record<string, unknown>;
  thinkingLevel: ThinkingLevel;
}): Promise<T> {
  const ai = getAiClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
          thinkingConfig: { thinkingLevel: params.thinkingLevel },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Model returned an empty response.');
      }
      return JSON.parse(rawText) as T;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate structured response from Gemini.');
}

function filterValidRowIds(ids: unknown, maxRow: number): number[] {
  if (!Array.isArray(ids)) return [];
  const unique = new Set<number>();
  for (const item of ids) {
    const n = Number(item);
    if (Number.isInteger(n) && n >= 1 && n <= maxRow) {
      unique.add(n);
    }
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function buildSourcePayload(sourceRows: SourceRow[]): string {
  return sourceRows
    .map((r) => `Row ${r.rowIndex}: ${JSON.stringify(r.rawFields)} | raw="${r.rawText}"`)
    .join('\n');
}

const AI_CACHE_TTL_MS = 15 * 60 * 1000;
const AI_CACHE_MAX_ENTRIES = 100;
const aiResponseCache = new Map<string, { expiresAt: number; data: unknown }>();

function makeCacheKey(route: string, payload: unknown): string {
  return createHash('sha256').update(`${route}:${JSON.stringify(payload)}`).digest('hex');
}

function getCachedAiResponse<T>(key: string): T | null {
  const hit = aiResponseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    aiResponseCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCachedAiResponse(key: string, data: unknown): void {
  if (aiResponseCache.size >= AI_CACHE_MAX_ENTRIES) {
    const oldestKey = aiResponseCache.keys().next().value;
    if (oldestKey) aiResponseCache.delete(oldestKey);
  }
  aiResponseCache.set(key, { expiresAt: Date.now() + AI_CACHE_TTL_MS, data });
}

function buildCompactEvidenceDigest(normalization: NormalizationResult) {
  const allRows = normalization.readings.map(
    (r) =>
      `R${r.rowIndex}|${r.timestampIso || 'no-ts'}|${r.station}|${r.pollutant}=${r.normalizedValue ?? 'null'} ${r.normalizedUnit}|NAQI=${r.naqiSubIndex ?? 'na'}(${r.naqiCategory})|${r.status}${r.whoExceeded ? '|WHO!' : ''}${r.issueNote ? `|${r.issueNote.slice(0, 80)}` : ''}`
  );

  const anomalyRows = normalization.readings
    .filter((r) => r.status === 'anomaly')
    .map((r) => ({
      rowIndex: r.rowIndex,
      station: r.station,
      pollutant: r.pollutant,
      value: r.normalizedValue,
      unit: r.normalizedUnit,
      note: r.issueNote,
    }));

  const gapRows = normalization.readings
    .filter((r) => r.status === 'missing')
    .map((r) => r.rowIndex);

  return {
    title: normalization.datasetTitle,
    rows: normalization.totalSourceRows,
    valid: normalization.validCount,
    gaps: normalization.gapCount,
    anomalies: normalization.anomalyCount,
    anomalyRows,
    gapRows,
    overallNaqi: normalization.overallNaqi,
    overallCategory: normalization.overallCategory,
    dominantPollutant: normalization.dominantPollutant,
    confidence: normalization.overallConfidence,
    stations: normalization.stationSummaries.map((s) => ({
      station: s.station,
      peakNaqi: s.peakNaqi,
      peakCategory: s.peakCategory,
      dominant: s.dominantPollutant,
      whoExceedances: s.whoExceedanceCount,
      citedRows: s.citedRows,
    })),
    issues: normalization.issues.map((i) => ({
      severity: i.severity,
      title: i.title,
      affectedRows: i.affectedRows,
    })),
    allRows,
  };
}

const ROLE_INSTRUCTIONS: Record<UserRole, string> = {
  ward_officer:
    'Ward Officer (Municipal Enforcement Authority): Can ONLY recommend actions within municipal ward powers such as construction & demolition (C&D) dust audits, mechanized road sweeping, water tankers/anti-smog guns, local commercial traffic diversion, idling checks, and open biomass/waste burning penalties. Do NOT suggest school closures or private society DG limits as direct orders.',
  housing_society:
    'Housing Society (RWA / Residential Management): Can ONLY recommend premise-level actions within RWA authority such as limiting non-essential diesel generator (DG) set runtime, water sprinkling on internal driveways, halting horticulture leaf burning, checking basement ventilation, and issuing resident/elderly advisories. Do NOT suggest municipal road diversions or city-wide fines.',
  school:
    'School Administration (Principal / Campus Safety): Can ONLY recommend campus-level actions such as moving morning assemblies indoors, suspending outdoor PT/sports, enforcing no-idling in school bus bays, closing cross-ventilation during peak plumes or running HEPA/air purifiers in classrooms, N95/KN95 masking, and asthma inhaler readiness. Do NOT suggest municipal road sweeping or industrial audits.',
};

export function createApp() {
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeadersMiddleware);
app.use(express.json({ limit: '2mb' }));

const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  keyPrefix: 'auth',
});

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'ai',
});

// Authentication & Session Endpoints
app.get('/api/auth/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = extractAuthUser(req);
  res.json({ user: user || null });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { name, organization, email, role, password } = req.body as {
    name?: unknown;
    organization?: unknown;
    email?: unknown;
    role?: unknown;
    password?: unknown;
  };

  const cleanName = sanitizeTextInput(name, 80);
  const cleanOrg = sanitizeTextInput(organization, 120);
  const cleanEmail = sanitizeTextInput(email, 160).toLowerCase();
  const rawPassword = typeof password === 'string' ? password : '';

  if (!cleanName || cleanName.length < 2) {
    res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    return;
  }
  if (!cleanOrg || cleanOrg.length < 2) {
    res.status(400).json({ error: 'Please enter your ward, housing society, or school name.' });
    return;
  }
  if (!isValidEmail(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!isValidRole(role)) {
    res.status(400).json({ error: 'Please select a valid civic role.' });
    return;
  }

  const strengthError = validatePasswordStrength(rawPassword);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  const created = registerAccount({
    name: cleanName,
    organization: cleanOrg,
    email: cleanEmail,
    role,
    password: rawPassword,
  });

  if (!created.ok) {
    res.status(created.status).json({ error: created.error });
    return;
  }

  const token = signSessionToken(created.user);
  setSessionCookie(req, res, token, false);
  res.status(201).json({ user: created.user, sessionToken: token });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { email, role, password } = req.body as {
    email?: unknown;
    role?: unknown;
    password?: unknown;
  };

  const cleanEmail = sanitizeTextInput(email, 160).toLowerCase();
  const rawPassword = typeof password === 'string' ? password : '';

  if (!isValidEmail(cleanEmail) || !rawPassword) {
    res.status(400).json({ error: 'Please enter a valid email address and password.' });
    return;
  }
  if (!isValidRole(role)) {
    res.status(400).json({ error: 'Please select a valid civic role.' });
    return;
  }

  const lockout = checkLoginLockout(req, cleanEmail, role);
  if (lockout.locked) {
    res.setHeader('Retry-After', String(lockout.retryAfterSec));
    res.status(429).json({
      error: `Too many failed login attempts. Account sign-in temporarily locked for ${Math.ceil(lockout.retryAfterSec / 60)} min (${lockout.retryAfterSec}s).`,
    });
    return;
  }

  const authenticated = authenticateAccount({
    email: cleanEmail,
    role,
    password: rawPassword,
  });

  if (!authenticated) {
    const attempt = recordFailedLogin(req, cleanEmail, role);
    if (attempt.lockedOut) {
      res.setHeader('Retry-After', String(attempt.retryAfterSec));
      res.status(429).json({
        error: `Too many failed attempts. Login temporarily locked for ${Math.ceil(attempt.retryAfterSec / 60)} minutes.`,
      });
      return;
    }
    res.status(401).json({
      error: `Invalid email, role, or password. ${attempt.remainingAttempts} attempt(s) remaining before temporary lockout.`,
    });
    return;
  }

  clearFailedLogin(req, cleanEmail, role);
  const token = signSessionToken(authenticated);
  setSessionCookie(req, res, token, false);
  res.json({ user: authenticated, sessionToken: token });
});

app.post('/api/auth/evaluator-session', authLimiter, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { role } = req.body as { role?: unknown };
  if (!isValidRole(role)) {
    res.status(400).json({ error: 'Invalid civic role requested.' });
    return;
  }

  const labelMap: Record<UserRole, { name: string; org: string; email: string }> = {
    ward_officer: {
      name: 'Ward Officer Evaluator',
      org: 'Municipal Enforcement Sandbox',
      email: 'ward.evaluator@vayu.civic',
    },
    housing_society: {
      name: 'RWA Coordinator Evaluator',
      org: 'Housing Society Sandbox',
      email: 'rwa.evaluator@vayu.civic',
    },
    school: {
      name: 'School Principal Evaluator',
      org: 'Campus Safety Sandbox',
      email: 'school.evaluator@vayu.civic',
    },
  };

  const info = labelMap[role];
  const demoUser: AuthUser = {
    id: `eval-${role}-${randomBytes(6).toString('hex')}`,
    name: info.name,
    organization: info.org,
    email: info.email,
    role,
    createdAt: new Date().toISOString(),
    isDemo: true,
  };

  const token = signSessionToken(demoUser);
  setSessionCookie(req, res, token, true);
  res.json({ user: demoUser, sessionToken: token });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/session-check', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, user: extractAuthUser(req) });
});

app.post('/api/normalize', aiLimiter, async (req, res) => {
  try {
    const { sourceRows, datasetTitle } = req.body as {
      sourceRows?: SourceRow[];
      datasetTitle?: string;
    };

    if (!Array.isArray(sourceRows) || sourceRows.length === 0) {
      res.status(400).json({ error: 'At least one input row is required for normalization.' });
      return;
    }
    if (sourceRows.length > 150) {
      res.status(400).json({ error: 'Maximum 150 rows supported per run for low-latency analysis.' });
      return;
    }

    const cacheKey = makeCacheKey('/api/normalize', { sourceRows, datasetTitle: datasetTitle || '' });
    const cached = getCachedAiResponse<NormalizationResult>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // 1. Fast deterministic pre-normalization (<5ms) for exact unit math, CPCB NAQI, and null gaps
    const { result: fastResult } = fastNormalizeSourceRows(sourceRows, datasetTitle);
    const maxRow = sourceRows.length;

    // 2. Compact Gemini AI Hygiene & Anomaly Audit (~150-350 output tokens instead of re-emitting 150 rows)
    const compactAuditInput = sourceRows
      .map((src, i) => {
        const pre = fastResult.readings[i];
        return `R${src.rowIndex} | raw="${src.rawText.slice(0, 180)}" | parsed: ${pre.station}, ${pre.pollutant}=${pre.normalizedValue ?? 'null'} ${pre.normalizedUnit}, ts=${pre.timestampIso || 'null'}, status=${pre.status}${pre.issueNote ? `, note="${pre.issueNote.slice(0, 60)}"` : ''}`;
      })
      .join('\n');

    const systemInstruction = `You are Vayu AI, an expert environmental data hygiene & anomaly auditor.
Review ALL ${maxRow} rows (1..${maxRow}) together with their deterministic pre-parse output.
Return ONLY a compact JSON diff (do NOT echo unchanged valid rows!):
1. rowCorrections: Return an entry ONLY for rows that:
   - Have an ANOMALY missed by fixed thresholds (e.g., sudden statistical spike compared to adjacent readings/stations, negative/zero stuck sensor fault, implausible jump, or raw text/notes indicating malfunction/calibration/diesel-test/spike/error). Mark status='anomaly' with a concise issueNote explaining why.
   - Were unparsed ('Unknown' or missing value even though rawText contains a numeric reading). Extract station, pollutant, timestampIso, normalizedValue (ug/m3 for PM2.5/PM10/NO2/SO2/O3, mg/m3 for CO), and status.
   NEVER invent or impute values for blank/NA/-- sensor dropouts—keep missing rows as status='missing' and normalizedValue=null.
2. issues: Group all real gaps, anomalies/outliers, format issues, and unit conversions found across 1..${maxRow} with exact affectedRows.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        datasetTitle: { type: Type.STRING },
        rowCorrections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              rowIndex: { type: Type.INTEGER },
              status: { type: Type.STRING, enum: ['valid', 'missing', 'anomaly'] },
              pollutant: { type: Type.STRING, nullable: true },
              station: { type: Type.STRING, nullable: true },
              timestampIso: { type: Type.STRING, nullable: true },
              normalizedValue: { type: Type.NUMBER, nullable: true },
              normalizedUnit: { type: Type.STRING, nullable: true },
              issueNote: { type: Type.STRING },
            },
            required: ['rowIndex', 'status', 'issueNote'],
          },
        },
        issues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['gap', 'outlier', 'format', 'unit_mismatch'] },
              title: { type: Type.STRING },
              explanation: { type: Type.STRING },
              affectedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              reliabilityImpact: { type: Type.STRING },
            },
            required: ['id', 'severity', 'title', 'explanation', 'affectedRows', 'reliabilityImpact'],
          },
        },
      },
      required: ['datasetTitle', 'rowCorrections', 'issues'],
    };

    const audit = await generateJsonWithRetry<{
      datasetTitle: string;
      rowCorrections: AiRowAuditCorrection[];
      issues: NormalizationResult['issues'];
    }>({
      systemInstruction,
      contents: `Dataset label: ${datasetTitle || 'Uploaded Monitoring Dataset'}\n\nRows (${maxRow} total):\n${compactAuditInput}`,
      responseSchema,
      thinkingLevel: ThinkingLevel.LOW,
    });

    const auditedResult = applyAiAuditCorrections(
      fastResult,
      audit.rowCorrections || [],
      audit.issues || [],
      datasetTitle || audit.datasetTitle
    );

    setCachedAiResponse(cacheKey, auditedResult);
    res.json(auditedResult);
  } catch (error) {
    console.error('Normalize error:', error);
    const message = error instanceof Error ? error.message : 'Normalization failed.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/brief', aiLimiter, async (req, res) => {
  try {
    const { normalization, role, language, readingLevel } = req.body as {
      normalization?: NormalizationResult;
      role?: UserRole;
      language?: AdvisoryLanguage;
      readingLevel?: ReadingLevel;
    };

    if (!normalization || !Array.isArray(normalization.readings) || normalization.readings.length === 0) {
      res.status(400).json({ error: 'Verified normalized dataset is required before generating briefs.' });
      return;
    }

    const activeRole: UserRole = role || 'ward_officer';
    const activeLang: AdvisoryLanguage = language || 'en';
    const activeLevel: ReadingLevel = readingLevel || 'standard';
    const maxRow = normalization.totalSourceRows;
    const digest = buildCompactEvidenceDigest(normalization);
    const cacheKey = makeCacheKey('/api/brief', {
      digest,
      role: activeRole,
      language: activeLang,
      readingLevel: activeLevel,
    });
    const cached = getCachedAiResponse<{
      internalBriefing: InternalBriefing;
      citizenAdvisory: CitizenAdvisory;
    }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const systemInstruction = `You are Vayu AI, generating grounded dual-output air-quality briefings strictly from verified sensor readings.
Keep responses crisp and scannable for low latency: 3 keyFindings (1-2 sentences each), 3 actionPlan items (1-2 sentences each), and 3-4 concise generalActions.

CRITICAL ANTI-HALLUCINATION RULES:
1. Only reference stations, pollutants, timestamps, and values present in the provided normalized digest.
2. Every keyFinding, actionItem, and citizenAdvisory must cite valid rowIndex numbers from 1..${maxRow}.
3. Note any missing readings or anomaly spikes in reliabilityCaveat; NEVER treat anomalous spikes as confirmed ambient exposure.
4. ROLE AUTHORITY CONSTRAINT:
${ROLE_INSTRUCTIONS[activeRole]}
5. CITIZEN ADVISORY RULES:
- Language: ${activeLang === 'hi' ? 'Hindi (natural, clear Devanagari script)' : 'English'}
- Reading Level: ${activeLevel === 'simple' ? 'Simple / Elementary (short sentences, everyday words, zero technical jargon)' : 'Standard (clear public-health notice with CPCB/WHO context)'}
- Include brief practical guidance for children, older adults, and respiratory-sensitive individuals.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        internalBriefing: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            confidenceLevel: { type: Type.STRING, enum: ['High', 'Moderate', 'Low'] },
            reliabilityCaveat: { type: Type.STRING },
            keyFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  claim: { type: Type.STRING },
                  citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['label', 'claim', 'citedRows'],
              },
            },
            actionPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING, enum: ['Immediate', 'Short-Term', 'Precautionary'] },
                  title: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  authorityScope: { type: Type.STRING },
                  citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['priority', 'title', 'rationale', 'authorityScope', 'citedRows'],
              },
            },
          },
          required: ['executiveSummary', 'confidenceLevel', 'reliabilityCaveat', 'keyFindings', 'actionPlan'],
        },
        citizenAdvisory: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            summary: { type: Type.STRING },
            generalActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            vulnerableGroups: {
              type: Type.OBJECT,
              properties: {
                children: { type: Type.STRING },
                olderAdults: { type: Type.STRING },
                respiratorySensitive: { type: Type.STRING },
              },
              required: ['children', 'olderAdults', 'respiratorySensitive'],
            },
            validUntilNote: { type: Type.STRING },
            citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ['headline', 'summary', 'generalActions', 'vulnerableGroups', 'validUntilNote', 'citedRows'],
        },
      },
      required: ['internalBriefing', 'citizenAdvisory'],
    };

    const result = await generateJsonWithRetry<{
      internalBriefing: InternalBriefing;
      citizenAdvisory: Omit<CitizenAdvisory, 'language' | 'readingLevel'>;
    }>({
      systemInstruction,
      contents: `Verified Digest:\n${JSON.stringify(digest)}`,
      responseSchema,
      thinkingLevel: ThinkingLevel.LOW,
    });

    const sanitizedBriefing: InternalBriefing = {
      ...result.internalBriefing,
      keyFindings: (result.internalBriefing.keyFindings || []).map((f) => ({
        ...f,
        citedRows: filterValidRowIds(f.citedRows, maxRow),
      })),
      actionPlan: (result.internalBriefing.actionPlan || []).map((a) => ({
        ...a,
        citedRows: filterValidRowIds(a.citedRows, maxRow),
      })),
    };

    const sanitizedAdvisory: CitizenAdvisory = {
      ...result.citizenAdvisory,
      language: activeLang,
      readingLevel: activeLevel,
      citedRows: filterValidRowIds(result.citizenAdvisory.citedRows, maxRow),
    };

    const responsePayload = {
      internalBriefing: sanitizedBriefing,
      citizenAdvisory: sanitizedAdvisory,
    };
    setCachedAiResponse(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error('Brief generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate briefings.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/advisory', aiLimiter, async (req, res) => {
  try {
    const { normalization, internalBriefing, language, readingLevel } = req.body as {
      normalization?: NormalizationResult;
      internalBriefing?: InternalBriefing;
      language?: AdvisoryLanguage;
      readingLevel?: ReadingLevel;
    };

    if (!normalization) {
      res.status(400).json({ error: 'Normalized dataset is required.' });
      return;
    }

    const activeLang: AdvisoryLanguage = language || 'en';
    const activeLevel: ReadingLevel = readingLevel || 'standard';
    const maxRow = normalization.totalSourceRows;
    const digest = buildCompactEvidenceDigest(normalization);
    const cacheKey = makeCacheKey('/api/advisory', {
      digest,
      language: activeLang,
      readingLevel: activeLevel,
    });
    const cached = getCachedAiResponse<CitizenAdvisory>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const systemInstruction = `You are Vayu AI's public health communicator. Rewrite the Citizen Advisory strictly from the verified air-quality digest below (3-4 concise generalActions, short clear sentences).
Do NOT invent any new numbers, stations, or dates.
Language: ${activeLang === 'hi' ? 'Hindi (clear, natural Devanagari script)' : 'English'}.
Reading Level: ${activeLevel === 'simple' ? 'Simple / Elementary (short sentences, everyday words, Grade 4-5 readability, no chemical jargon)' : 'Standard (clear public health bulletin with CPCB/WHO context)'}.
Include brief guidance for children, older adults, and respiratory-sensitive individuals, plus citedRows from 1..${maxRow}.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        summary: { type: Type.STRING },
        generalActions: { type: Type.ARRAY, items: { type: Type.STRING } },
        vulnerableGroups: {
          type: Type.OBJECT,
          properties: {
            children: { type: Type.STRING },
            olderAdults: { type: Type.STRING },
            respiratorySensitive: { type: Type.STRING },
          },
          required: ['children', 'olderAdults', 'respiratorySensitive'],
        },
        validUntilNote: { type: Type.STRING },
        citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
      },
      required: ['headline', 'summary', 'generalActions', 'vulnerableGroups', 'validUntilNote', 'citedRows'],
    };

    const result = await generateJsonWithRetry<Omit<CitizenAdvisory, 'language' | 'readingLevel'>>({
      systemInstruction,
      contents: JSON.stringify({
        ...digest,
        reliabilityCaveat: internalBriefing?.reliabilityCaveat || '',
      }),
      responseSchema,
      thinkingLevel: ThinkingLevel.LOW,
    });

    const responsePayload: CitizenAdvisory = {
      ...result,
      language: activeLang,
      readingLevel: activeLevel,
      citedRows: filterValidRowIds(result.citedRows, maxRow),
    };
    setCachedAiResponse(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error('Advisory translation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update Citizen Advisory.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/compare', aiLimiter, async (req, res) => {
  try {
    const { currentNormalization, previousLabel, previousContent } = req.body as {
      currentNormalization?: NormalizationResult;
      previousLabel?: string;
      previousContent?: string;
    };

    if (!currentNormalization) {
      res.status(400).json({ error: 'Current normalized dataset is required.' });
      return;
    }
    if (!previousContent || !previousContent.trim()) {
      res.status(400).json({ error: 'A previous brief or report is required for comparison.' });
      return;
    }

    const maxRow = currentNormalization.totalSourceRows;
    const digest = buildCompactEvidenceDigest(currentNormalization);
    const cacheKey = makeCacheKey('/api/compare', {
      digest,
      previousLabel: previousLabel || 'Prior Baseline',
      previousContent: previousContent.slice(0, 6000),
    });
    const cached = getCachedAiResponse<ComparisonResult>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const systemInstruction = `You are Vayu AI's historical comparison analyst ("What Changed").
Compare the CURRENT verified digest against the PREVIOUS report/briefing concisely (max 4 stations per list, 1 crisp sentence per deltaNote).
Rules:
1. NEVER fabricate stations or readings that do not appear in either the previous report or current digest.
2. Categorize zones accurately into: worseningZones, improvingZones, or persistentHotspots. Mention dropouts honestly in dataQualityCaveat.
3. Every zone delta MUST cite valid rowIndex numbers (1..${maxRow}) from the CURRENT dataset.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        baselineLabel: { type: Type.STRING },
        currentLabel: { type: Type.STRING },
        executiveDelta: { type: Type.STRING },
        worseningZones: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              station: { type: Type.STRING },
              trend: {
                type: Type.STRING,
                enum: ['worsening', 'improving', 'persistent_hotspot', 'insufficient_data'],
              },
              previousValue: { type: Type.STRING },
              currentValue: { type: Type.STRING },
              deltaNote: { type: Type.STRING },
              citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            },
            required: ['station', 'trend', 'previousValue', 'currentValue', 'deltaNote', 'citedRows'],
          },
        },
        improvingZones: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              station: { type: Type.STRING },
              trend: {
                type: Type.STRING,
                enum: ['worsening', 'improving', 'persistent_hotspot', 'insufficient_data'],
              },
              previousValue: { type: Type.STRING },
              currentValue: { type: Type.STRING },
              deltaNote: { type: Type.STRING },
              citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            },
            required: ['station', 'trend', 'previousValue', 'currentValue', 'deltaNote', 'citedRows'],
          },
        },
        persistentHotspots: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              station: { type: Type.STRING },
              trend: {
                type: Type.STRING,
                enum: ['worsening', 'improving', 'persistent_hotspot', 'insufficient_data'],
              },
              previousValue: { type: Type.STRING },
              currentValue: { type: Type.STRING },
              deltaNote: { type: Type.STRING },
              citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            },
            required: ['station', 'trend', 'previousValue', 'currentValue', 'deltaNote', 'citedRows'],
          },
        },
        dataQualityCaveat: { type: Type.STRING },
      },
      required: [
        'baselineLabel',
        'currentLabel',
        'executiveDelta',
        'worseningZones',
        'improvingZones',
        'persistentHotspots',
        'dataQualityCaveat',
      ],
    };

    const result = await generateJsonWithRetry<ComparisonResult>({
      systemInstruction,
      contents: `PREVIOUS REPORT (${previousLabel || 'Prior Baseline'}):\n${previousContent.slice(0, 6000)}\n\nCURRENT VERIFIED DIGEST:\n${JSON.stringify(digest)}`,
      responseSchema,
      thinkingLevel: ThinkingLevel.LOW,
    });

    const sanitizeDeltas = (list: ComparisonResult['worseningZones']) =>
      (list || []).map((item) => ({
        ...item,
        citedRows: filterValidRowIds(item.citedRows, maxRow),
      }));

    const responsePayload: ComparisonResult = {
      ...result,
      baselineLabel: previousLabel || result.baselineLabel || 'Previous Report',
      currentLabel: currentNormalization.datasetTitle,
      worseningZones: sanitizeDeltas(result.worseningZones),
      improvingZones: sanitizeDeltas(result.improvingZones),
      persistentHotspots: sanitizeDeltas(result.persistentHotspots),
    };
    setCachedAiResponse(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error('Compare error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compare historical reports.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/brief-all-roles', aiLimiter, async (req, res) => {
  try {
    const { normalization } = req.body as {
      normalization?: NormalizationResult;
    };

    if (!normalization || !Array.isArray(normalization.readings) || normalization.readings.length === 0) {
      res.status(400).json({ error: 'Verified normalized dataset is required.' });
      return;
    }

    const maxRow = normalization.totalSourceRows;
    const digest = buildCompactEvidenceDigest(normalization);
    const cacheKey = makeCacheKey('/api/brief-all-roles', digest);
    const cached = getCachedAiResponse<Record<UserRole, ActionItem[]>>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const systemInstruction = `You are Vayu AI. Generate 3 concise, SEPARATE, non-overlapping action items per authority based ONLY on the verified digest below:
1. ward_officer: ${ROLE_INSTRUCTIONS.ward_officer}
2. housing_society: ${ROLE_INSTRUCTIONS.housing_society}
3. school: ${ROLE_INSTRUCTIONS.school}
Keep each rationale to 1 crisp sentence, cite valid rowIndex numbers (1..${maxRow}), and NEVER fabricate measurements.`;

    const actionItemSchema = {
      type: Type.OBJECT,
      properties: {
        priority: { type: Type.STRING, enum: ['Immediate', 'Short-Term', 'Precautionary'] },
        title: { type: Type.STRING },
        rationale: { type: Type.STRING },
        authorityScope: { type: Type.STRING },
        citedRows: { type: Type.ARRAY, items: { type: Type.INTEGER } },
      },
      required: ['priority', 'title', 'rationale', 'authorityScope', 'citedRows'],
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        ward_officer: { type: Type.ARRAY, items: actionItemSchema },
        housing_society: { type: Type.ARRAY, items: actionItemSchema },
        school: { type: Type.ARRAY, items: actionItemSchema },
      },
      required: ['ward_officer', 'housing_society', 'school'],
    };

    const result = await generateJsonWithRetry<Record<UserRole, ActionItem[]>>({
      systemInstruction,
      contents: JSON.stringify(digest),
      responseSchema,
      thinkingLevel: ThinkingLevel.LOW,
    });

    const sanitize = (items: ActionItem[] | undefined) =>
      (items || []).map((a) => ({
        ...a,
        citedRows: filterValidRowIds(a.citedRows, maxRow),
      }));

    const responsePayload = {
      ward_officer: sanitize(result.ward_officer),
      housing_society: sanitize(result.housing_society),
      school: sanitize(result.school),
    };
    setCachedAiResponse(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error('All-roles brief error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate role matrix.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/pawan', aiLimiter, async (req, res) => {
  try {
    const { message, context } = req.body as {
      message?: string;
      context?: {
        activeStep?: string;
        isAuthenticated?: boolean;
        hasData?: boolean;
        hasNormalized?: boolean;
        datasetTitle?: string;
        overallNaqi?: number | null;
        overallCategory?: string;
        currentLanguage?: AdvisoryLanguage;
      };
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Please enter a question for Pawan.' });
      return;
    }

    const systemInstruction = `You are Pawan, the helpful civic air-quality guide and feature navigator inside Vayu AI.
Your ONLY purpose is to:
1. Clearly explain Vayu AI features (Messy Data Ingestion, Data Quality & Integrity Dashboards, Heatmaps, Pollutant Unit Converter, CPCB NAQI + WHO 2021 Thresholds, Row-Level Traceability, Role-Based Actions for Ward Officer / Housing Society / School, Multilingual English/Hindi & Simple/Standard Citizen Advisories, and What Changed Historical Compare).
2. Route users directly to the right page and function by returning structured suggestedActions buttons.
3. Users can immediately open "ingest", "hygiene", "briefs", and "compare" without logging in first, or optionally visit "auth" to bind a saved Ward Officer, Housing Society, or School account.
4. NEVER hallucinate or invent sensor readings, AQI values, or fake station statistics. Only cite numbers present in the user's current context if data is loaded.
Keep answers concise (2–4 sentences), friendly, and practical. Respond in ${context?.currentLanguage === 'hi' ? 'Hindi or Hinglish/Hindi matching the user query' : 'the same language the user asks in (English or Hindi)'}.

Available pages (targetPage):
- "landing": Home overview with WHO/CPCB guidelines, Unit Converter tool, and Role cards
- "auth": Optional role-based Login & Register page (Ward Officer, Housing Society, School)
- "ingest": Upload CSV/Excel, paste messy raw tables, or click Load Messy Test Fixture
- "hygiene": Data Integrity Recharts monitor, Heatmaps, 5 Data-Quality graphs, Unit Converter, CPCB NAQI table
- "briefs": Dual-Output Briefing Studio & CSV Export
- "compare": Historical Comparison ("What Changed")`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        reply: { type: Type.STRING },
        suggestedActions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              targetPage: {
                type: Type.STRING,
                enum: ['landing', 'auth', 'ingest', 'hygiene', 'briefs', 'compare'],
              },
              targetRole: {
                type: Type.STRING,
                enum: ['ward_officer', 'housing_society', 'school'],
                nullable: true,
              },
              targetLanguage: {
                type: Type.STRING,
                enum: ['en', 'hi'],
                nullable: true,
              },
              loadFixture: { type: Type.BOOLEAN, nullable: true },
            },
            required: ['label', 'targetPage'],
          },
        },
      },
      required: ['reply', 'suggestedActions'],
    };

    const result = await generateJsonWithRetry<{
      reply: string;
      suggestedActions: PawanNavAction[];
    }>({
      systemInstruction,
      contents: `Current App State: ${JSON.stringify(context || {})}\n\nUser Question: ${message.trim().slice(0, 1000)}`,
      responseSchema,
      thinkingLevel: ThinkingLevel.LOW,
    });

    res.json(result);
  } catch (error) {
    console.error('Pawan assistant error:', error);
    const message = error instanceof Error ? error.message : 'Pawan could not respond right now.';
    res.status(500).json({ error: message });
  }
});

    // Update guide prompt to reflect open ingestion + optional auth
    return app;
}

async function startServer() {
  const app = createApp();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vayu AI server running on http://0.0.0.0:${PORT}`);
  });
}

const isMainModule =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
