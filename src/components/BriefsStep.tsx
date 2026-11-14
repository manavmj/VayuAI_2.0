import React, { useState } from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Building2,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  GraduationCap,
  HeartPulse,
  Landmark,
  Layers,
  Printer,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type {
  ActionItem,
  AdvisoryLanguage,
  CitizenAdvisory,
  InternalBriefing,
  NormalizationResult,
  ReadingLevel,
  UserRole,
} from '../types/vayu.ts';
import { ROLE_META } from '../utils/naqi.ts';
import { VayuWordmark } from './VayuWordmark.tsx';

interface BriefsStepProps {
  normalization: NormalizationResult | null;
  role: UserRole;
  onChangeRole: (role: UserRole) => void;
  internalBriefing: InternalBriefing | null;
  citizenAdvisory: CitizenAdvisory | null;
  allRolesMatrix: Record<UserRole, ActionItem[]> | null;
  isLoadingAllRoles: boolean;
  onGenerateAllRoles: () => void;
  language: AdvisoryLanguage;
  readingLevel: ReadingLevel;
  onUpdateAdvisorySettings: (lang: AdvisoryLanguage, level: ReadingLevel) => void;
  isLoadingBrief: boolean;
  isUpdatingAdvisory: boolean;
  onInspectRows: (rows: number[], title?: string) => void;
  onSaveSnapshot: () => void;
  isSnapshotSaved: boolean;
  onProceedToCompare: () => void;
  onGoToIngest: () => void;
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  ward_officer: <Landmark className="h-4 w-4" aria-hidden="true" />,
  housing_society: <Building2 className="h-4 w-4" aria-hidden="true" />,
  school: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
};

const ROLE_IMAGES: Record<UserRole, { src: string; alt: string }> = {
  ward_officer: {
    src: '/src/assets/images/civic_ward_monitoring_1794640282835.jpg',
    alt: 'Urban municipal avenue with roadside solar air-quality monitoring kiosk',
  },
  housing_society: {
    src: '/src/assets/images/housing_society_greenery_1794640283246.jpg',
    alt: 'Residential housing society courtyard with green hedges and pathway misting',
  },
  school: {
    src: '/src/assets/images/school_clean_air_1794640284649.jpg',
    alt: 'School campus courtyard with green trees and ventilated classrooms',
  },
};

export const BriefsStep: React.FC<BriefsStepProps> = ({
  normalization,
  role,
  onChangeRole,
  internalBriefing,
  citizenAdvisory,
  allRolesMatrix,
  isLoadingAllRoles,
  onGenerateAllRoles,
  language,
  readingLevel,
  onUpdateAdvisorySettings,
  isLoadingBrief,
  isUpdatingAdvisory,
  onInspectRows,
  onSaveSnapshot,
  isSnapshotSaved,
  onProceedToCompare,
  onGoToIngest,
}) => {
  const [copiedAdvisory, setCopiedAdvisory] = useState(false);

  if (!normalization) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0fdf4] text-[#15803d] border border-[#16a34a]/20">
          <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-[#131b2e]">
          Role-Scoped Briefings Require Verified Data
        </h1>
        <p className="mx-auto max-w-md text-sm text-[#3f493f]">
          Vayu AI generates every Internal Briefing Note, Role Action Plan, and Citizen Advisory
          strictly from normalized input rows. Please ingest a dataset first.
        </p>
        <button
          type="button"
          onClick={onGoToIngest}
          className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00652c]"
        >
          Go to Data Ingestion
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  const handleCopyAdvisory = async () => {
    if (!citizenAdvisory) return;
    const text = [
      citizenAdvisory.headline,
      '',
      citizenAdvisory.summary,
      '',
      'Recommended Actions:',
      ...citizenAdvisory.generalActions.map((a) => `- ${a}`),
      '',
      `Children: ${citizenAdvisory.vulnerableGroups.children}`,
      `Older Adults: ${citizenAdvisory.vulnerableGroups.olderAdults}`,
      `Respiratory-Sensitive: ${citizenAdvisory.vulnerableGroups.respiratorySensitive}`,
      '',
      citizenAdvisory.validUntilNote,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedAdvisory(true);
      setTimeout(() => setCopiedAdvisory(false), 2000);
    } catch {
      // Clipboard blocked in sandboxed iframe
    }
  };

  const handleExportCsv = () => {
    if (!internalBriefing || !citizenAdvisory) return;

    const escapeCsv = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      const neutralized = /^[=+\-@]/.test(str) ? `'${str}` : str;
      return `"${neutralized.replace(/"/g, '""')}"`;
    };

    const formatRows = (rows: number[]) =>
      rows.length > 0 ? rows.map((r) => `Row #${r}`).join('; ') : 'None';

    const csvLines: string[] = [
      [
        'Section',
        'Category',
        'Role_Or_Target',
        'Priority_Or_Mode',
        'Title_Or_Label',
        'Details',
        'Authority_Scope_Or_Group',
        'Cited_Rows',
      ]
        .map(escapeCsv)
        .join(','),
    ];

    const pushRow = (cols: Array<string | number | null | undefined>) => {
      csvLines.push(cols.map(escapeCsv).join(','));
    };

    // Dataset & Executive Overview
    pushRow([
      'Metadata',
      'Dataset Overview',
      ROLE_META[role].label,
      internalBriefing.confidenceLevel,
      normalization.datasetTitle,
      `Overall CPCB NAQI: ${normalization.overallNaqi ?? 'N/A'} (${normalization.overallCategory}); Dominant Pollutant: ${normalization.dominantPollutant}; Valid Rows: ${normalization.validCount}/${normalization.totalSourceRows}; Gaps: ${normalization.gapCount}; Anomalies: ${normalization.anomalyCount}`,
      ROLE_META[role].shortTitle,
      'All',
    ]);

    pushRow([
      'Internal Briefing',
      'Executive Summary',
      ROLE_META[role].label,
      internalBriefing.confidenceLevel,
      'Executive Summary',
      internalBriefing.executiveSummary,
      ROLE_META[role].authoritySummary,
      'Verified Batch',
    ]);

    if (internalBriefing.reliabilityCaveat) {
      pushRow([
        'Internal Briefing',
        'Data Reliability Caveat',
        ROLE_META[role].label,
        internalBriefing.confidenceLevel,
        'Reliability Warning',
        internalBriefing.reliabilityCaveat,
        'Data Hygiene',
        'Flagged Rows',
      ]);
    }

    // Internal Findings
    for (const finding of internalBriefing.keyFindings) {
      pushRow([
        'Internal Briefing',
        'Traceable Finding',
        ROLE_META[role].label,
        internalBriefing.confidenceLevel,
        finding.label,
        finding.claim,
        'Evidence Ledger',
        formatRows(finding.citedRows),
      ]);
    }

    // Active Role Action Plan
    for (const action of internalBriefing.actionPlan) {
      pushRow([
        'Internal Briefing',
        'Role Action Item',
        ROLE_META[role].label,
        action.priority,
        action.title,
        action.rationale,
        action.authorityScope,
        formatRows(action.citedRows),
      ]);
    }

    // Separate 3-Role Matrix (if generated)
    if (allRolesMatrix) {
      (['ward_officer', 'housing_society', 'school'] as UserRole[]).forEach((rKey) => {
        for (const item of allRolesMatrix[rKey] || []) {
          pushRow([
            'All-Roles Matrix',
            'Authority Action',
            ROLE_META[rKey].label,
            item.priority,
            item.title,
            item.rationale,
            item.authorityScope,
            formatRows(item.citedRows),
          ]);
        }
      });
    }

    // Citizen Advisory
    const advisoryMode = `${citizenAdvisory.language.toUpperCase()} / ${citizenAdvisory.readingLevel}`;
    pushRow([
      'Citizen Advisory',
      'Public Notice',
      'General Public',
      advisoryMode,
      citizenAdvisory.headline,
      citizenAdvisory.summary,
      citizenAdvisory.validUntilNote,
      formatRows(citizenAdvisory.citedRows),
    ]);

    citizenAdvisory.generalActions.forEach((precaution, idx) => {
      pushRow([
        'Citizen Advisory',
        'General Precaution',
        'General Public',
        advisoryMode,
        `Precaution ${idx + 1}`,
        precaution,
        'Community Guidance',
        formatRows(citizenAdvisory.citedRows),
      ]);
    });

    pushRow([
      'Citizen Advisory',
      'Vulnerable Group Care',
      'Children',
      advisoryMode,
      'Children Protection Guidance',
      citizenAdvisory.vulnerableGroups.children,
      'Children',
      formatRows(citizenAdvisory.citedRows),
    ]);
    pushRow([
      'Citizen Advisory',
      'Vulnerable Group Care',
      'Older Adults',
      advisoryMode,
      'Older Adults Protection Guidance',
      citizenAdvisory.vulnerableGroups.olderAdults,
      'Older Adults',
      formatRows(citizenAdvisory.citedRows),
    ]);
    pushRow([
      'Citizen Advisory',
      'Vulnerable Group Care',
      'Respiratory-Sensitive',
      advisoryMode,
      'Respiratory & Cardiac Protection Guidance',
      citizenAdvisory.vulnerableGroups.respiratorySensitive,
      'Respiratory-Sensitive',
      formatRows(citizenAdvisory.citedRows),
    ]);

    const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSlug = (normalization.datasetTitle || 'vayu-briefing')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link.href = url;
    link.download = `${safeSlug}-${role}-${citizenAdvisory.language}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const roleMeta = ROLE_META[role];
  const roleImage = ROLE_IMAGES[role];

  return (
    <section aria-labelledby="briefs-heading" className="space-y-8">
      {/* Masthead */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-slate-200 pb-5 no-print">
        <div className="space-y-2">
          <VayuWordmark variant="briefs" />
          <h1
            id="briefs-heading"
            className="font-display text-2xl sm:text-3xl font-semibold text-[#131b2e]"
          >
            Role-Scoped Briefings &amp; Public Advisory Studio
          </h1>
          <p className="text-sm text-[#3f493f] max-w-[68ch]">
            Switch authority personas to tailor interventions to real operational powers, compare
            all 3 roles separately, and toggle bilingual reading levels for citizen notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isLoadingAllRoles}
            onClick={onGenerateAllRoles}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#131b2e] hover:bg-[#faf8ff] disabled:opacity-60 whitespace-nowrap"
          >
            <Layers className="h-4 w-4 text-[#15803d]" aria-hidden="true" />
            {isLoadingAllRoles
              ? 'Building 3-Role Matrix...'
              : allRolesMatrix
                ? 'Refresh All 3 Roles'
                : 'View All 3 Roles Separately'}
          </button>

          <button
            type="button"
            disabled={!internalBriefing || !citizenAdvisory}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#131b2e] hover:bg-[#faf8ff] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#16a34a]"
          >
            <Download className="h-4 w-4 text-[#15803d]" aria-hidden="true" />
            Export Briefing to CSV
          </button>

          <button
            type="button"
            disabled={!internalBriefing || !citizenAdvisory}
            onClick={onSaveSnapshot}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#16a34a] ${
              isSnapshotSaved
                ? 'border-[#16a34a] bg-[#dcfce7] text-[#14532d]'
                : 'border-[#16a34a]/30 bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7]'
            }`}
          >
            {isSnapshotSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                Saved for Comparison
              </>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                Save Brief to History
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onProceedToCompare}
            className="inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#00652c] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#16a34a]"
          >
            What Changed (Compare)
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Persona / Role Selector with Documentary Visual Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 rounded-2xl border border-slate-200 bg-white p-5 no-print items-center">
        <div className="lg:col-span-3 overflow-hidden rounded-xl aspect-[4/3] bg-[#f0fdf4]">
          <img
            src={roleImage.src}
            alt={roleImage.alt}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#131b2e]">
                Active Decision-Maker Persona: {roleMeta.label}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{roleMeta.authoritySummary}</p>
            </div>

            <div
              role="tablist"
              aria-label="Select Decision-Maker Role"
              className="flex flex-wrap items-center gap-1 rounded-xl bg-[#f2f3ff] p-1 shrink-0"
            >
              {(['ward_officer', 'housing_society', 'school'] as UserRole[]).map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={isLoadingBrief}
                    onClick={() => onChangeRole(r)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#15803d] text-white shadow-sm'
                        : 'text-[#3f493f] hover:bg-white hover:text-[#131b2e]'
                    }`}
                  >
                    {ROLE_ICONS[r]}
                    {ROLE_META[r].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            {roleMeta.scopeBoundaries.map((boundary) => (
              <div
                key={boundary}
                className="rounded-lg bg-[#faf8ff] border border-slate-200/80 px-3 py-2 text-xs text-[#3f493f]"
              >
                {boundary}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Optional Separate All-3-Roles Breakdown Matrix */}
      {allRolesMatrix && (
        <div className="space-y-4 rounded-2xl border border-[#16a34a]/25 bg-[#f0fdf4]/40 p-6 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#131b2e]">
                Separate Role-Based Action Matrix (Ward Officer vs. Housing Society vs. School)
              </h2>
              <p className="text-xs text-[#3f493f]">
                Non-overlapping interventions scoped strictly to each role&apos;s jurisdiction from{' '}
                <span className="font-semibold">{normalization.datasetTitle}</span>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {(['ward_officer', 'housing_society', 'school'] as UserRole[]).map((rKey) => {
              const items = allRolesMatrix[rKey] || [];
              return (
                <div
                  key={rKey}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
                >
                  <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                    <img
                      src={ROLE_IMAGES[rKey].src}
                      alt={ROLE_IMAGES[rKey].alt}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-3 flex-1">
                    <div className="flex items-center gap-2 text-[#00652c]">
                      {ROLE_ICONS[rKey]}
                      <h3 className="font-display text-base font-bold text-[#131b2e]">
                        {ROLE_META[rKey].label}
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200/80 bg-[#faf8ff] p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                item.priority === 'Immediate'
                                  ? 'bg-[#ffdad6] text-[#93000a]'
                                  : item.priority === 'Short-Term'
                                    ? 'bg-[#fef9c3] text-[#854d0e]'
                                    : 'bg-[#dcfce7] text-[#14532d]'
                              }`}
                            >
                              {item.priority}
                            </span>
                            {item.citedRows.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onInspectRows(item.citedRows, item.title)}
                                className="font-mono text-[10px] font-semibold text-[#00652c] hover:underline"
                              >
                                Rows {item.citedRows.map((id) => `#${id}`).join(', ')}
                              </button>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-[#131b2e]">{item.title}</p>
                          <p className="text-[11px] text-[#3f493f] leading-relaxed">
                            {item.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dual Output Grid */}
      {isLoadingBrief ? (
        <div aria-live="polite" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-[460px] rounded-2xl border border-slate-200 bg-white p-6 animate-pulse space-y-4">
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="h-20 w-full rounded bg-slate-100" />
            <div className="h-32 w-full rounded bg-slate-100" />
            <div className="h-32 w-full rounded bg-slate-100" />
          </div>
          <div className="lg:col-span-6 h-[460px] rounded-2xl border border-slate-200 bg-white p-6 animate-pulse space-y-4">
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="h-20 w-full rounded bg-slate-100" />
            <div className="h-32 w-full rounded bg-slate-100" />
            <div className="h-32 w-full rounded bg-slate-100" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Output 1: Internal Briefing Note */}
          <article className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#00652c]">
                  Internal Briefing Note · {roleMeta.label}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-[#131b2e]">
                  Technical Assessment &amp; Action Plan
                </h2>
              </div>
              {internalBriefing && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold shrink-0 ${
                    internalBriefing.confidenceLevel === 'High'
                      ? 'bg-[#dcfce7] text-[#14532d] border-[#bbf7d0]'
                      : 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]'
                  }`}
                >
                  {internalBriefing.confidenceLevel} Confidence
                </span>
              )}
            </div>

            {internalBriefing ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-[#131b2e]">
                    {internalBriefing.executiveSummary}
                  </p>
                  {internalBriefing.reliabilityCaveat && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-[#fde047] bg-[#fef9c3]/50 p-3.5 text-xs text-[#854d0e]">
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-semibold">Data Reliability Caveat: </span>
                        {internalBriefing.reliabilityCaveat}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cited Findings */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">
                    Traceable Findings ({normalization.datasetTitle})
                  </h3>
                  <div className="space-y-2.5">
                    {internalBriefing.keyFindings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200/80 bg-[#faf8ff] p-3.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#131b2e]">
                            {finding.label}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {finding.citedRows.map((rowId) => (
                              <button
                                key={rowId}
                                type="button"
                                onClick={() => onInspectRows([rowId], finding.label)}
                                className="rounded border border-[#16a34a]/30 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#00652c] hover:bg-[#f0fdf4]"
                              >
                                Row #{rowId}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-[#3f493f] leading-relaxed">{finding.claim}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Authority-Scoped Action Plan */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">
                    Prioritized Interventions ({roleMeta.shortTitle} Authority)
                  </h3>
                  <div className="space-y-3">
                    {internalBriefing.actionPlan.map((action, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              action.priority === 'Immediate'
                                ? 'bg-[#ffdad6] text-[#93000a]'
                                : action.priority === 'Short-Term'
                                  ? 'bg-[#fef9c3] text-[#854d0e]'
                                  : 'bg-[#dcfce7] text-[#14532d]'
                            }`}
                          >
                            {action.priority}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {action.authorityScope}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#131b2e]">{action.title}</h4>
                        <p className="text-xs text-[#3f493f] leading-relaxed">{action.rationale}</p>
                        {action.citedRows.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-slate-500">Evidence:</span>
                            {action.citedRows.map((rowId) => (
                              <button
                                key={rowId}
                                type="button"
                                onClick={() => onInspectRows(action.citedRows, action.title)}
                                className="rounded border border-[#16a34a]/30 bg-[#faf8ff] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#00652c] hover:bg-[#f0fdf4]"
                              >
                                Row #{rowId}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Briefing not generated yet.</p>
            )}
          </article>

          {/* Output 2: Citizen Advisory with Multilingual & Reading Level Controls */}
          <article className="lg:col-span-6 rounded-2xl border border-[#16a34a]/25 bg-white p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
                  Citizen Advisory · Public Health Notice
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-[#131b2e]">
                  Community &amp; Vulnerable Group Guidance
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={handleCopyAdvisory}
                  disabled={!citizenAdvisory}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-slate-100"
                >
                  {copiedAdvisory ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#15803d]" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-1.5 text-xs font-semibold text-[#131b2e] hover:bg-slate-100"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  Print
                </button>
              </div>
            </div>

            {/* Multilingual & Reading-Level Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f0fdf4] border border-[#16a34a]/20 p-3 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#14532d]">Language:</span>
                <div className="inline-flex rounded-lg bg-white p-0.5 border border-[#16a34a]/20">
                  <button
                    type="button"
                    disabled={isUpdatingAdvisory}
                    onClick={() => onUpdateAdvisorySettings('en', readingLevel)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      language === 'en'
                        ? 'bg-[#15803d] text-white'
                        : 'text-[#3f493f] hover:text-[#131b2e]'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingAdvisory}
                    onClick={() => onUpdateAdvisorySettings('hi', readingLevel)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      language === 'hi'
                        ? 'bg-[#15803d] text-white'
                        : 'text-[#3f493f] hover:text-[#131b2e]'
                    }`}
                  >
                    हिन्दी (Hindi)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#14532d]">Reading Level:</span>
                <div className="inline-flex rounded-lg bg-white p-0.5 border border-[#16a34a]/20">
                  <button
                    type="button"
                    disabled={isUpdatingAdvisory}
                    onClick={() => onUpdateAdvisorySettings(language, 'simple')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      readingLevel === 'simple'
                        ? 'bg-[#15803d] text-white'
                        : 'text-[#3f493f] hover:text-[#131b2e]'
                    }`}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingAdvisory}
                    onClick={() => onUpdateAdvisorySettings(language, 'standard')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      readingLevel === 'standard'
                        ? 'bg-[#15803d] text-white'
                        : 'text-[#3f493f] hover:text-[#131b2e]'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>
            </div>

            {isUpdatingAdvisory ? (
              <div aria-live="polite" className="py-12 text-center text-sm text-[#15803d] font-medium">
                Updating Citizen Advisory ({language === 'hi' ? 'Hindi' : 'English'} ·{' '}
                {readingLevel === 'simple' ? 'Simple' : 'Standard'})...
              </div>
            ) : citizenAdvisory ? (
              <div lang={citizenAdvisory.language} className="space-y-5">
                <div className="rounded-xl bg-[#faf8ff] border border-slate-200 p-4 space-y-2">
                  <h3 className="font-display text-lg font-bold text-[#131b2e]">
                    {citizenAdvisory.headline}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#3f493f]">{citizenAdvisory.summary}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">
                    General Public Precautions
                  </h4>
                  <ul className="mt-2.5 space-y-2">
                    {citizenAdvisory.generalActions.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[#131b2e] leading-relaxed"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 rounded-full bg-[#15803d] shrink-0"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Vulnerable Groups Care Cards */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">
                    Extra Care for Vulnerable Groups
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-[#f0fdf4]/50 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#14532d]">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        <span>{language === 'hi' ? 'बच्चे (Children)' : 'Children'}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#131b2e] leading-relaxed">
                        {citizenAdvisory.vulnerableGroups.children}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-[#fef9c3]/30 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#854d0e]">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        <span>{language === 'hi' ? 'वरिष्ठ नागरिक (Older Adults)' : 'Older Adults'}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#131b2e] leading-relaxed">
                        {citizenAdvisory.vulnerableGroups.olderAdults}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-[#ffdad6]/30 p-3.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#93000a]">
                        <HeartPulse className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {language === 'hi'
                            ? 'श्वसन रोगी (Respiratory-Sensitive)'
                            : 'Respiratory & Cardiac Sensitive'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#131b2e] leading-relaxed">
                        {citizenAdvisory.vulnerableGroups.respiratorySensitive}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>{citizenAdvisory.validUntilNote}</span>
                  {citizenAdvisory.citedRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onInspectRows(citizenAdvisory.citedRows, 'Citizen Advisory Source Rows')
                      }
                      className="font-mono font-semibold text-[#00652c] hover:underline"
                    >
                      Verify {citizenAdvisory.citedRows.length} cited rows
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </article>
        </div>
      )}
    </section>
  );
};
