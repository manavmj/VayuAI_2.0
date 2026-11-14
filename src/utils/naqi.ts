import type { NaqiCategory, SavedBriefSnapshot, UserRole } from '../types/vayu.ts';

export const ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortTitle: string;
    authoritySummary: string;
    scopeBoundaries: string[];
  }
> = {
  ward_officer: {
    label: 'Ward Officer',
    shortTitle: 'Municipal Ward',
    authoritySummary:
      'Municipal enforcement over road dust control, C&D site audits, traffic diversions, and open-burning compliance.',
    scopeBoundaries: [
      'Construction & demolition dust compliance audits',
      'Mechanized road sweeping & anti-smog gun deployment',
      'Local commercial traffic diversion & idling fines',
    ],
  },
  housing_society: {
    label: 'Housing Society',
    shortTitle: 'RWA / Campus',
    authoritySummary:
      'Premise-level operational controls over DG sets, landscaping dust suppression, basement ventilation, and resident advisories.',
    scopeBoundaries: [
      'DG set non-essential runtime limits & emission checks',
      'Internal pathway water sprinkling & leaf-burning bans',
      'Resident advisory circulation & senior-citizen check-ins',
    ],
  },
  school: {
    label: 'School',
    shortTitle: 'School Admin',
    authoritySummary:
      'Student & staff health governance across outdoor assemblies, physical education schedules, masking, and classroom ventilation.',
    scopeBoundaries: [
      'Moving morning assemblies & PT sessions indoors',
      'N95/KN95 masking protocols & inhaler readiness',
      'Bus-bay no-idling enforcement & parent notifications',
    ],
  },
};

export function getNaqiStyle(category: NaqiCategory): {
  bg: string;
  text: string;
  border: string;
  range: string;
} {
  switch (category) {
    case 'Good':
      return {
        bg: 'bg-[#dcfce7]',
        text: 'text-[#14532d]',
        border: 'border-[#bbf7d0]',
        range: '0–50',
      };
    case 'Satisfactory':
      return {
        bg: 'bg-[#ecfccb]',
        text: 'text-[#365314]',
        border: 'border-[#d9f99d]',
        range: '51–100',
      };
    case 'Moderate':
      return {
        bg: 'bg-[#fef9c3]',
        text: 'text-[#854d0e]',
        border: 'border-[#fde047]',
        range: '101–200',
      };
    case 'Poor':
      return {
        bg: 'bg-[#ffedd5]',
        text: 'text-[#9a3412]',
        border: 'border-[#fdba74]',
        range: '201–300',
      };
    case 'Very Poor':
      return {
        bg: 'bg-[#fee2e2]',
        text: 'text-[#991b1b]',
        border: 'border-[#fca5a5]',
        range: '301–400',
      };
    case 'Severe':
      return {
        bg: 'bg-[#ffdad6]',
        text: 'text-[#93000a]',
        border: 'border-[#f87171]',
        range: '401–500',
      };
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        range: 'N/A',
      };
  }
}

const HISTORY_STORAGE_KEY = 'vayu_ai_saved_briefs_v1';

export function loadSavedBriefs(): SavedBriefSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBriefSnapshot(snapshot: SavedBriefSnapshot): SavedBriefSnapshot[] {
  const existing = loadSavedBriefs().filter((item) => item.id !== snapshot.id);
  const next = [snapshot, ...existing].slice(0, 12);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteSavedBrief(id: string): SavedBriefSnapshot[] {
  const next = loadSavedBriefs().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  return next;
}
