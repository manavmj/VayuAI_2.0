export type WorkspaceStep = 'landing' | 'auth' | 'ingest' | 'hygiene' | 'briefs' | 'compare';

export interface AuthUser {
  id: string;
  name: string;
  organization: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isDemo?: boolean;
}

export type NaqiCategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Unavailable';

export type ReadingStatus = 'valid' | 'missing' | 'anomaly';

export type UserRole = 'ward_officer' | 'housing_society' | 'school';

export type AdvisoryLanguage = 'en' | 'hi';

export type ReadingLevel = 'simple' | 'standard';

export interface SourceRow {
  rowIndex: number;
  rawText: string;
  rawFields: Record<string, string>;
}

export interface NormalizedReading {
  rowIndex: number;
  timestampIso: string | null;
  station: string;
  pollutant: string;
  rawValue: string;
  rawUnit: string;
  normalizedValue: number | null;
  normalizedUnit: string;
  naqiSubIndex: number | null;
  naqiCategory: NaqiCategory;
  whoExceeded: boolean;
  whoGuideline: string;
  status: ReadingStatus;
  conversionNote: string;
  issueNote: string;
}

export interface HygieneIssue {
  id: string;
  severity: 'gap' | 'outlier' | 'format' | 'unit_mismatch';
  title: string;
  explanation: string;
  affectedRows: number[];
  reliabilityImpact: string;
}

export interface StationSummary {
  station: string;
  readingCount: number;
  validCount: number;
  gapCount: number;
  anomalyCount: number;
  peakNaqi: number | null;
  peakCategory: NaqiCategory;
  dominantPollutant: string;
  whoExceedanceCount: number;
  citedRows: number[];
}

export interface NormalizationResult {
  datasetTitle: string;
  totalSourceRows: number;
  validCount: number;
  gapCount: number;
  anomalyCount: number;
  overallConfidence: 'High' | 'Moderate' | 'Low';
  overallNaqi: number | null;
  overallCategory: NaqiCategory;
  dominantPollutant: string;
  readings: NormalizedReading[];
  issues: HygieneIssue[];
  stationSummaries: StationSummary[];
}

export interface BriefingCitation {
  label: string;
  claim: string;
  citedRows: number[];
}

export interface ActionItem {
  priority: 'Immediate' | 'Short-Term' | 'Precautionary';
  title: string;
  rationale: string;
  authorityScope: string;
  citedRows: number[];
}

export interface InternalBriefing {
  executiveSummary: string;
  confidenceLevel: 'High' | 'Moderate' | 'Low';
  reliabilityCaveat: string;
  keyFindings: BriefingCitation[];
  actionPlan: ActionItem[];
}

export interface CitizenAdvisory {
  language: AdvisoryLanguage;
  readingLevel: ReadingLevel;
  headline: string;
  summary: string;
  generalActions: string[];
  vulnerableGroups: {
    children: string;
    olderAdults: string;
    respiratorySensitive: string;
  };
  validUntilNote: string;
  citedRows: number[];
}

export interface SavedBriefSnapshot {
  id: string;
  savedAt: string;
  label: string;
  sourceRows: SourceRow[];
  normalization: NormalizationResult;
  role: UserRole;
  internalBriefing: InternalBriefing;
  citizenAdvisory: CitizenAdvisory;
}

export interface ComparisonZoneDelta {
  station: string;
  trend: 'worsening' | 'improving' | 'persistent_hotspot' | 'insufficient_data';
  previousValue: string;
  currentValue: string;
  deltaNote: string;
  citedRows: number[];
}

export interface ComparisonResult {
  baselineLabel: string;
  currentLabel: string;
  executiveDelta: string;
  worseningZones: ComparisonZoneDelta[];
  improvingZones: ComparisonZoneDelta[];
  persistentHotspots: ComparisonZoneDelta[];
  dataQualityCaveat: string;
}

export interface PawanNavAction {
  label: string;
  targetPage: WorkspaceStep;
  targetRole?: UserRole;
  targetLanguage?: AdvisoryLanguage;
  loadFixture?: boolean;
}

export interface PawanMessage {
  id: string;
  sender: 'user' | 'pawan';
  text: string;
  actions?: PawanNavAction[];
}
