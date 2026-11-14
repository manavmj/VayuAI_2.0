import React from 'react';
import { Languages, Leaf, LogOut, ZoomIn, ZoomOut } from 'lucide-react';
import type { AdvisoryLanguage, AuthUser, WorkspaceStep } from '../types/vayu.ts';
import { ROLE_META } from '../utils/naqi.ts';

interface TopBarProps {
  activeStep: WorkspaceStep;
  onSelectStep: (step: WorkspaceStep) => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
  hasNormalizedData: boolean;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  primaryActionDisabled?: boolean;
  language: AdvisoryLanguage;
  onChangeLanguage: (lang: AdvisoryLanguage) => void;
  zoomPct: number;
  onChangeZoom: (zoom: number) => void;
  datasetTitle?: string;
}

const AUTH_STEPS: { id: WorkspaceStep; labelEn: string; labelHi: string }[] = [
  { id: 'landing', labelEn: 'Home', labelHi: 'होम' },
  { id: 'ingest', labelEn: '01. Ingest', labelHi: '01. डेटा अपलोड' },
  { id: 'hygiene', labelEn: '02. Dashboards', labelHi: '02. डैशबोर्ड' },
  { id: 'briefs', labelEn: '03. Briefs & Roles', labelHi: '03. ब्रीफिंग' },
  { id: 'compare', labelEn: '04. Compare', labelHi: '04. तुलना' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeStep,
  onSelectStep,
  currentUser,
  onLogout,
  hasNormalizedData,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionDisabled = false,
  language,
  onChangeLanguage,
  zoomPct,
  onChangeZoom,
  datasetTitle,
}) => {
  const isHi = language === 'hi';

  return (
    <header className="sticky top-0 z-30 no-print">
      {/* Main 3-Zone Top Bar */}
      <div className="bg-[#1b3120] text-white border-b border-white/10">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-4 py-3.5 sm:px-8">
          {/* Zone 1: Brand wordmark */}
          <button
            type="button"
            onClick={() => onSelectStep('landing')}
            className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#eab308] rounded"
          >
            <Leaf className="h-5 w-5 text-[#7cf994]" aria-hidden="true" />
            <span>Vayu AI</span>
          </button>

          {/* Zone 2: Navigation — only show Ingest/Dashboards/Briefs/Compare AFTER login */}
          {currentUser ? (
            <nav aria-label="Workspace Steps" className="hidden lg:flex items-center gap-7">
              {AUTH_STEPS.map((step) => {
                const active = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onSelectStep(step.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#eab308] rounded ${
                      active ? 'text-[#95f8a7] font-semibold' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {isHi ? step.labelHi : step.labelEn}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-[#eab308]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav aria-label="Public Navigation" className="hidden md:flex items-center gap-7">
              <button
                type="button"
                onClick={() => onSelectStep('landing')}
                aria-current={activeStep === 'landing' ? 'page' : undefined}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeStep === 'landing'
                    ? 'text-[#95f8a7] font-semibold'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {isHi ? 'होम और दिशानिर्देश' : 'Home & Guidelines'}
              </button>
              <button
                type="button"
                onClick={() => onSelectStep('auth')}
                aria-current={activeStep === 'auth' ? 'page' : undefined}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeStep === 'auth'
                    ? 'text-[#95f8a7] font-semibold'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {isHi ? 'भूमिका लॉगिन / पंजीकरण' : 'Role Login / Register'}
              </button>
            </nav>
          )}

          {/* Zone 3: Single primary contextual CTA */}
          <div className="shrink-0">
            <button
              type="button"
              disabled={primaryActionDisabled}
              onClick={onPrimaryAction}
              className="rounded-lg bg-[#eab308] px-4 py-2 text-sm font-bold text-[#131b2e] transition-all duration-150 hover:bg-[#facc15] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {primaryActionLabel}
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        {currentUser && (
          <nav
            aria-label="Mobile Workspace Steps"
            className="flex lg:hidden items-center justify-between gap-2 border-t border-white/10 bg-[#142518] px-4 py-2 overflow-x-auto"
          >
            {AUTH_STEPS.map((step) => {
              const active = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                    active ? 'bg-[#eab308] text-[#131b2e]' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  {isHi ? step.labelHi : step.labelEn}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Slim Global Accessibility, Session & Language Utility Bar */}
      <div className="border-b border-[#16a34a]/15 bg-[#f0fdf4]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-8 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-[#14532d]">
            {currentUser ? (
              <>
                <span className="font-semibold">
                  {ROLE_META[currentUser.role].label} · {currentUser.organization}
                </span>
                <span aria-hidden="true" className="text-[#16a34a]/40">
                  |
                </span>
                <span>
                  {hasNormalizedData && datasetTitle
                    ? `${isHi ? 'डेटासेट:' : 'Dataset:'} ${datasetTitle}`
                    : isHi
                      ? 'डेटा अपलोड करने के लिए तैयार'
                      : 'Authenticated — ready for data ingestion'}
                </span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1 rounded border border-[#16a34a]/30 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#15803d] hover:bg-[#dcfce7]"
                >
                  <LogOut className="h-3 w-3" aria-hidden="true" />
                  {isHi ? 'लॉगआउट' : 'Sign Out'}
                </button>
              </>
            ) : (
              <span className="font-semibold">
                {isHi
                  ? 'डेटा अपलोड और डैशबोर्ड खोलने के लिए कृपया अपनी भूमिका से लॉगिन करें'
                  : 'Sign in or register as a Ward Officer, Housing Society, or School to unlock ingestion & dashboards'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Global Multilingual Selector */}
            <div className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5 text-[#15803d]" aria-hidden="true" />
              <span className="font-semibold text-[#14532d] hidden sm:inline">
                {isHi ? 'भाषा:' : 'Language:'}
              </span>
              <div className="inline-flex rounded-md border border-[#16a34a]/25 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => onChangeLanguage('en')}
                  aria-pressed={language === 'en'}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    language === 'en'
                      ? 'bg-[#15803d] text-white'
                      : 'text-[#3f493f] hover:text-[#131b2e]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLanguage('hi')}
                  aria-pressed={language === 'hi'}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    language === 'hi'
                      ? 'bg-[#15803d] text-white'
                      : 'text-[#3f493f] hover:text-[#131b2e]'
                  }`}
                >
                  हिन्दी
                </button>
              </div>
            </div>

            {/* Global Workspace Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#14532d] hidden sm:inline">
                {isHi ? 'ज़ूम:' : 'Zoom:'}
              </span>
              <div className="inline-flex items-center rounded-md border border-[#16a34a]/25 bg-white px-1 py-0.5">
                <button
                  type="button"
                  aria-label="Zoom out workspace"
                  disabled={zoomPct <= 85}
                  onClick={() => onChangeZoom(Math.max(85, zoomPct - 10))}
                  className="rounded p-1 text-[#15803d] hover:bg-[#f0fdf4] disabled:opacity-40"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChangeZoom(100)}
                  title="Reset zoom to 100%"
                  className="px-2 font-mono text-[11px] font-semibold text-[#131b2e] tabular-nums"
                >
                  {zoomPct}%
                </button>
                <button
                  type="button"
                  aria-label="Zoom in workspace"
                  disabled={zoomPct >= 130}
                  onClick={() => onChangeZoom(Math.min(130, zoomPct + 10))}
                  className="rounded p-1 text-[#15803d] hover:bg-[#f0fdf4] disabled:opacity-40"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
