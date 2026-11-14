import React from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  GitCompare,
  Languages,
  LogIn,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AdvisoryLanguage, AuthUser, UserRole } from '../types/vayu.ts';
import { HERO_CANOPY_IMAGE, ROLE_CIVIC_IMAGES } from '../assets/civicImages.ts';
import { UnitConverterTool } from './UnitConverterTool.tsx';
import { VayuWordmark } from './VayuWordmark.tsx';

interface LandingStepProps {
  language: AdvisoryLanguage;
  currentUser: AuthUser | null;
  onOpenAuth: (mode: 'login' | 'register', role?: UserRole) => void;
  onStartIngest: () => void;
  onLoadFixtureAndAudit: () => void;
  onJumpToRole: (role: UserRole) => void;
  isProcessingFixture: boolean;
}

const ROLE_CARDS: {
  role: UserRole;
  titleEn: string;
  titleHi: string;
  image: string;
  alt: string;
  authorityEn: string;
  authorityHi: string;
  actionsEn: string[];
  actionsHi: string[];
}[] = [
  {
    role: 'ward_officer',
    titleEn: 'Ward Officer',
    titleHi: 'वार्ड अधिकारी',
    image: ROLE_CIVIC_IMAGES.ward_officer.src,
    alt: ROLE_CIVIC_IMAGES.ward_officer.alt,
    authorityEn: 'Municipal street-level enforcement, dust audits & traffic control',
    authorityHi: 'सड़क की धूल नियंत्रण, निर्माण स्थल जांच और ट्रैफिक प्रबंधन',
    actionsEn: [
      'Deploy mechanized road sweeping & anti-smog water tankers on hotspot corridors',
      'Audit nearby construction & demolition (C&D) sites for dust covers',
      'Divert heavy diesel freight & enforce idling checks at bottlenecks',
    ],
    actionsHi: [
      'हॉटस्पॉट सड़कों पर मैकेनाइज्ड स्वीपिंग और पानी के छिड़काव की तैनाती',
      'निर्माण स्थलों पर धूल नियंत्रण और कवर की जांच',
      'भीड़भाड़ वाले चौराहों पर भारी डीजल वाहनों का डायवर्जन',
    ],
  },
  {
    role: 'housing_society',
    titleEn: 'Housing Society (RWA)',
    titleHi: 'हाउसिंग सोसाइटी (RWA)',
    image: ROLE_CIVIC_IMAGES.housing_society.src,
    alt: ROLE_CIVIC_IMAGES.housing_society.alt,
    authorityEn: 'Premise-level operational limits, generator scheduling & resident care',
    authorityHi: 'परिसर स्तर पर डीजी सेट नियंत्रण, छिड़काव और निवासी सुरक्षा',
    actionsEn: [
      'Restrict non-essential diesel generator (DG) runtime during peak inversion',
      'Schedule pathway water sprinkling & prohibit horticulture leaf burning',
      'Issue bilingual elevator/WhatsApp notices & check on elderly residents',
    ],
    actionsHi: [
      'अधिक प्रदूषण के समय गैर-जरूरी डीजल जनरेटर के उपयोग को सीमित करना',
      'परिसर के रास्तों पर पानी का छिड़काव और सूखे पत्तों को जलाने पर रोक',
      'वरिष्ठ नागरिकों की देखभाल और निवासियों के लिए स्वास्थ्य सूचना जारी करना',
    ],
  },
  {
    role: 'school',
    titleEn: 'School Administration',
    titleHi: 'विद्यालय प्रशासन',
    image: ROLE_CIVIC_IMAGES.school.src,
    alt: ROLE_CIVIC_IMAGES.school.alt,
    authorityEn: 'Student schedule adjustments, masking & campus indoor air hygiene',
    authorityHi: 'छात्रों की सुरक्षा, इनडोर प्रार्थना सभा और मास्क नियम',
    actionsEn: [
      'Shift morning assemblies & outdoor PT/sports strictly indoors',
      'Enforce bus-bay no-idling zones & distribute N95/KN95 guidance',
      'Keep asthma inhalers ready in infirmary & close windows during peak plumes',
    ],
    actionsHi: [
      'सुबह की प्रार्थना सभा और खेलकूद को तुरंत इनडोर हॉल में स्थानांतरित करना',
      'स्कूल बस क्षेत्र में इंजन बंद रखने का नियम और मास्क उपयोग सुनिश्चित करना',
      'दमा से प्रभावित बच्चों के लिए इनहेलर और मेडिकल रूम की तैयारी रखना',
    ],
  },
];

const GUIDELINES_ROWS = [
  {
    pollutant: 'PM2.5',
    who24h: '15 µg/m³',
    cpcbGood: '0–30 µg/m³',
    cpcbPoorPlus: '> 90 µg/m³',
    healthImpact: 'Penetrates deep lungs & bloodstream; critical for children & asthma',
  },
  {
    pollutant: 'PM10',
    who24h: '45 µg/m³',
    cpcbGood: '0–50 µg/m³',
    cpcbPoorPlus: '> 250 µg/m³',
    healthImpact: 'Coarse road & construction dust irritating upper airways',
  },
  {
    pollutant: 'NO2',
    who24h: '25 µg/m³',
    cpcbGood: '0–40 µg/m³',
    cpcbPoorPlus: '> 180 µg/m³',
    healthImpact: 'Traffic & diesel exhaust gas worsening bronchial inflammation',
  },
  {
    pollutant: 'SO2',
    who24h: '40 µg/m³',
    cpcbGood: '0–40 µg/m³',
    cpcbPoorPlus: '> 380 µg/m³',
    healthImpact: 'Industrial/kiln emissions triggering acute airway constriction',
  },
  {
    pollutant: 'CO (8h)',
    who24h: '4 mg/m³',
    cpcbGood: '0–1 mg/m³',
    cpcbPoorPlus: '> 10 mg/m³',
    healthImpact: 'Idling-vehicle & DG exhaust reducing blood oxygen delivery',
  },
];

export const LandingStep: React.FC<LandingStepProps> = ({
  language,
  currentUser,
  onOpenAuth,
  onStartIngest,
  onLoadFixtureAndAudit,
  onJumpToRole,
  isProcessingFixture,
}) => {
  const isHi = language === 'hi';

  return (
    <div className="space-y-12">
      {/* Green Nature Canopy Hero Template */}
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden rounded-[2.5rem_0.75rem_2.5rem_0.75rem] border border-[#16a34a]/20 bg-[#132a17] shadow-[0_24px_48px_-12px_rgba(20,83,45,0.22)]"
      >
        <img
          src={HERO_CANOPY_IMAGE}
          alt="Sunlit green forest canopy representing clean breathable civic air"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0a1d0f]/85 via-[#0f2916]/65 to-[#0a1d0f]/45"
        />

        <div className="relative z-10 px-6 py-16 sm:px-12 sm:py-24 lg:py-28 max-w-4xl space-y-6 text-white">
          <div className="inline-flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-md px-4 py-2 border border-white/20">
            <span className="font-display text-lg font-bold tracking-wide text-[#95f8a7]">
              Vayu AI
            </span>
            <span aria-hidden="true" className="text-white/40">
              |
            </span>
            <span className="text-xs font-medium text-white/90">
              {isHi
                ? 'नागरिक वायु गुणवत्ता ब्रीफिंग स्टूडियो'
                : 'Civic Air Quality Briefing Studio'}
            </span>
          </div>

          <h1
            id="hero-title"
            className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.02em] leading-[1.08] text-balance"
          >
            {isHi ? (
              <>
                स्वच्छ हवा के लिए <span className="text-[#95f8a7]">सटीक नागरिक निर्णय</span>
              </>
            ) : (
              <>
                MAKE THIS AIR <span className="text-[#95f8a7]">Cleaner For Every Ward</span>
              </>
            )}
          </h1>

          <p className="max-w-2xl text-base sm:text-lg text-white/90 leading-relaxed">
            {isHi
              ? 'अव्यवस्थित सेंसर डेटा (CSV, Excel या कच्ची तालिकाओं) को विश्वसनीय भारतीय NAQI (CPCB) विश्लेषण, डेटा-गुणवत्ता ग्राफ़, भूमिका-आधारित कार्यों और हिंदी/अंग्रेज़ी नागरिक परामर्श में बदलें — बिना किसी काल्पनिक डेटा के।'
              : 'Turn messy raw air-quality tables into verified Indian NAQI (CPCB) datasets, data-quality graphs, heatmaps, traceable findings, and role-scoped action briefings for Ward Officers, Housing Societies, and Schools—with zero fabricated numbers.'}
          </p>

          {/* Hero CTAs: Immediate ingestion & fixture audit enabled; optional role login beside it */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onStartIngest}
              className="inline-flex items-center gap-2 rounded-lg bg-[#eab308] px-6 py-3 text-sm font-bold text-[#131b2e] shadow-lg transition-all hover:bg-[#facc15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {isHi ? 'डेटा अपलोड या पेस्ट करें' : 'Open Data Ingestion'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              disabled={isProcessingFixture}
              onClick={onLoadFixtureAndAudit}
              className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/15 backdrop-blur-md px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-white/25 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Sparkles className="h-4 w-4 text-[#95f8a7]" aria-hidden="true" />
              {isProcessingFixture
                ? isHi
                  ? 'फ़िक्सचर प्रोसेस हो रहा है...'
                  : 'Running GenAI Hygiene Audit...'
                : isHi
                  ? 'टेस्ट डेटा लोड करें और देखें'
                  : 'Load Messy Test Fixture & Analyze'}
            </button>

            {!currentUser && (
              <button
                type="button"
                onClick={() => onOpenAuth('login', 'ward_officer')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/25 px-4 py-3 text-xs font-semibold text-white/95 transition-colors hover:bg-black/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <LogIn className="h-4 w-4 text-[#95f8a7]" aria-hidden="true" />
                {isHi ? 'भूमिका लॉगिन / पंजीकरण' : 'Role Login / Register'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* WHO 2021 & CPCB NAQI Guidelines Section (Visible on Home before login) */}
      <section aria-labelledby="guidelines-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
              {isHi ? 'विश्व स्वास्थ्य संगठन और CPCB मानक' : 'Air Quality Standards & Public Health Guidelines'}
            </p>
            <h2
              id="guidelines-heading"
              className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#131b2e]"
            >
              {isHi
                ? 'WHO 2021 और भारतीय CPCB NAQI दिशानिर्देश'
                : 'WHO 2021 vs. Indian CPCB NAQI Reference Thresholds'}
            </h2>
          </div>

          <a
            href="https://www.who.int/publications/i/item/9789240034228"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#16a34a]/30 bg-[#f0fdf4] px-4 py-2 text-xs font-semibold text-[#15803d] hover:bg-[#dcfce7] shrink-0"
          >
            <span>{isHi ? 'आधिकारिक WHO 2021 दिशानिर्देश पढ़ें' : 'Read Official WHO 2021 Guidelines'}</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[#f2f3ff] text-[#131b2e] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Pollutant</th>
                <th className="px-4 py-3 font-mono font-semibold">WHO 2021 24h Limit</th>
                <th className="px-4 py-3 font-mono font-semibold">CPCB Good (0–50)</th>
                <th className="px-4 py-3 font-mono font-semibold">CPCB Poor+ (&gt;200)</th>
                <th className="px-4 py-3 font-semibold">Civic &amp; Vulnerable Group Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {GUIDELINES_ROWS.map((row) => (
                <tr key={row.pollutant} className="hover:bg-[#f0fdf4]/40">
                  <td className="px-4 py-3 font-mono font-bold text-[#00652c]">{row.pollutant}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#131b2e] tabular-nums">
                    {row.who24h}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#15803d] tabular-nums">
                    {row.cpcbGood}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#ba1a1a] tabular-nums">
                    {row.cpcbPoorPlus}
                  </td>
                  <td className="px-4 py-3 text-[#3f493f]">{row.healthImpact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Interactive Unit Converter Tool (Visible right on Home & Hygiene) */}
      <UnitConverterTool language={language} />

      {/* GenAI Core Capabilities Strip */}
      <section aria-labelledby="capabilities-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
              {isHi ? 'मुख्य जनरेटिव AI क्षमताएं' : 'How Vayu AI Works After Login'}
            </p>
            <h2
              id="capabilities-heading"
              className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#131b2e]"
            >
              {isHi
                ? 'डेटा विज्ञान स्वच्छता से लेकर नागरिक परामर्श तक'
                : 'Built for messy real-world logs, data science audit & civic action'}
            </h2>
          </div>
          <VayuWordmark variant="ingest" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5">
            <FileSpreadsheet className="h-5 w-5 text-[#15803d]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              {isHi ? 'अव्यवस्थित डेटा सामान्यीकरण' : 'Messy Data Normalization'}
            </h3>
            <p className="text-xs text-[#3f493f] leading-relaxed">
              {isHi
                ? 'µg/m³, ppm, ppb और टूटे हुए टाइमस्टैम्प को भारतीय CPCB NAQI में बदलता है और खाली मानों को बिना अनुमान लगाए चिह्नित करता है।'
                : 'GenAI converts mixed µg/m³, ppm, ppb, and malformed timestamps into Indian NAQI (CPCB) while keeping missing cells strictly null.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5">
            <BarChart3 className="h-5 w-5 text-[#15803d]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              {isHi ? 'डेटा गुणवत्ता डैशबोर्ड और हीटमैप' : 'Charts, Recharts & Heatmaps'}
            </h3>
            <p className="text-xs text-[#3f493f] leading-relaxed">
              {isHi
                ? 'ज़ूम करने योग्य ग्राफ़, डेटा अखंडता डैशबोर्ड, और स्टेशन × प्रदूषक हीटमैप से सेंसर की खामियां तुरंत पहचानें।'
                : 'Dynamic Recharts dropout/anomaly monitor, station-pollutant heatmaps, WHO multiples, and completeness scatter plots.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5">
            <ShieldCheck className="h-5 w-5 text-[#15803d]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              {isHi ? 'पंक्ति-स्तरीय सत्यापन (Zero Hallucination)' : 'Row-Level Traceability'}
            </h3>
            <p className="text-xs text-[#3f493f] leading-relaxed">
              {isHi
                ? 'हर निष्कर्ष और चेतावनी सीधे मूल इनपुट पंक्ति [Row #] से जुड़ी होती है, जिसे एक क्लिक में सत्यापित किया जा सकता है।'
                : 'Every hotspot, spike, and action links back to verifiable [Row #] indices checked by our server-side citation validator.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-[#15803d]" aria-hidden="true" />
              <GitCompare className="h-4 w-4 text-[#00652c]" aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold text-[#131b2e]">
              {isHi ? 'द्विभाषी ब्रीफिंग और तुलना' : 'Dual Briefs & What Changed'}
            </h3>
            <p className="text-xs text-[#3f493f] leading-relaxed">
              {isHi
                ? 'अधिकारियों के लिए तकनीकी नोट, बच्चों/बुजुर्गों के लिए सरल हिंदी/अंग्रेज़ी सूचना, और पिछली रिपोर्ट से तुलना।'
                : 'Technical Internal Note + Simple/Standard English & Hindi Citizen Advisory for vulnerable groups, plus historical delta comparison.'}
            </p>
          </div>
        </div>
      </section>

      {/* Separate Role-Based Action Cards with Role Login / Direct Jump */}
      <section aria-labelledby="roles-heading" className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
            {isHi ? 'भूमिका-आधारित कार्यप्रणाली' : 'Authority-Scoped Local Interventions'}
          </p>
          <h2
            id="roles-heading"
            className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#131b2e]"
          >
            {isHi
              ? 'प्रत्येक जिम्मेदार भूमिका के लिए अलग और सटीक कार्ययोजना'
              : 'Separate role-based actions tailored to real authority'}
          </h2>
          <p className="mt-1 text-sm text-[#3f493f] max-w-[72ch]">
            {isHi
              ? 'वार्ड अधिकारी, हाउसिंग सोसाइटी और स्कूल की शक्तियां अलग होती हैं। अपनी भूमिका के साथ लॉगिन करें।'
              : 'A ward officer, housing society, and school each control different levers. Sign in under your role to ingest data and generate scoped plans.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {ROLE_CARDS.map((card) => (
            <article
              key={card.role}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_12px_32px_-4px_rgba(21,128,61,0.1)]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f0fdf4]">
                <img
                  src={card.image}
                  alt={card.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between p-6 space-y-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[#131b2e]">
                      {isHi ? card.titleHi : card.titleEn}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-[#15803d]">
                      {isHi ? card.authorityHi : card.authorityEn}
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {(isHi ? card.actionsHi : card.actionsEn).map((act) => (
                      <li
                        key={act}
                        className="flex items-start gap-2 text-xs text-[#3f493f] leading-relaxed"
                      >
                        <CheckCircle2
                          className="h-4 w-4 text-[#16a34a] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToRole(card.role)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#16a34a]/30 bg-[#f0fdf4] px-4 py-2.5 text-xs font-semibold text-[#15803d] transition-colors hover:bg-[#dcfce7] focus-visible:outline-2 focus-visible:outline-[#16a34a]"
                >
                  {isHi ? `${card.titleHi} कार्य देखें` : `Open ${card.titleEn} Actions`}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
