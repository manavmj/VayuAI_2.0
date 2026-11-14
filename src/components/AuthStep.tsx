import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Landmark,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { AdvisoryLanguage, AuthUser, UserRole } from '../types/vayu.ts';
import { ROLE_META } from '../utils/naqi.ts';

interface StoredAccount extends AuthUser {
  passwordHash: string;
}

const ACCOUNTS_KEY = 'vayu_ai_accounts_v1';

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

interface AuthStepProps {
  initialMode: 'login' | 'register';
  initialRole: UserRole;
  language: AdvisoryLanguage;
  onAuthenticated: (user: AuthUser) => void;
  onBackHome: () => void;
}

const ROLE_CARDS: Array<{
  role: UserRole;
  icon: React.ReactNode;
  image: string;
  alt: string;
}> = [
  {
    role: 'ward_officer',
    icon: <Landmark className="h-4 w-4" aria-hidden="true" />,
    image: '/src/assets/images/civic_ward_monitoring_1794640282835.jpg',
    alt: 'Municipal ward roadside air quality monitoring station',
  },
  {
    role: 'housing_society',
    icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
    image: '/src/assets/images/housing_society_greenery_1794640283246.jpg',
    alt: 'Green residential housing society courtyard',
  },
  {
    role: 'school',
    icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
    image: '/src/assets/images/school_clean_air_1794640284649.jpg',
    alt: 'School campus courtyard with clean air trees',
  },
];

export const AuthStep: React.FC<AuthStepProps> = ({
  initialMode,
  initialRole,
  language,
  onAuthenticated,
  onBackHome,
}) => {
  const isHi = language === 'hi';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const accounts = loadAccounts();
      const pwHash = await hashPassword(password);

      if (mode === 'register') {
        if (!name.trim() || !organization.trim()) {
          setError('Please enter your full name and ward / society / school name.');
          setIsSubmitting(false);
          return;
        }
        const exists = accounts.some(
          (acc) => acc.email === trimmedEmail && acc.role === selectedRole
        );
        if (exists) {
          setError(
            `An account for ${trimmedEmail} under ${ROLE_META[selectedRole].label} already exists. Switch to Login.`
          );
          setIsSubmitting(false);
          return;
        }

        const newAccount: StoredAccount = {
          id: `usr-${Date.now()}`,
          name: name.trim(),
          organization: organization.trim(),
          email: trimmedEmail,
          role: selectedRole,
          createdAt: new Date().toISOString(),
          passwordHash: pwHash,
        };
        saveAccounts([newAccount, ...accounts]);
        const { passwordHash: _omit, ...publicUser } = newAccount;
        onAuthenticated(publicUser);
      } else {
        const matched = accounts.find(
          (acc) => acc.email === trimmedEmail && acc.role === selectedRole
        );
        if (!matched) {
          setError(
            `No registered ${ROLE_META[selectedRole].label} account found for ${trimmedEmail}. Please register first or use Instant Role Access below.`
          );
          setIsSubmitting(false);
          return;
        }
        if (matched.passwordHash !== pwHash) {
          setError('Incorrect password for this role account.');
          setIsSubmitting(false);
          return;
        }
        const { passwordHash: _omit, ...publicUser } = matched;
        onAuthenticated(publicUser);
      }
    } catch {
      setError('Authentication could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstantRoleAccess = (targetRole: UserRole) => {
    const labelMap: Record<UserRole, { name: string; org: string; email: string }> = {
      ward_officer: {
        name: 'Ward Officer Session',
        org: 'Municipal Enforcement Desk',
        email: 'ward.officer@vayu.civic',
      },
      housing_society: {
        name: 'RWA Coordinator Session',
        org: 'Housing Society Management',
        email: 'rwa.admin@vayu.civic',
      },
      school: {
        name: 'School Principal Session',
        org: 'Campus Health & Safety Desk',
        email: 'school.admin@vayu.civic',
      },
    };
    const info = labelMap[targetRole];
    onAuthenticated({
      id: `session-${targetRole}-${Date.now()}`,
      name: info.name,
      organization: info.org,
      email: info.email,
      role: targetRole,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <section aria-labelledby="auth-heading" className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
            {isHi ? 'भूमिका-आधारित प्रवेश' : 'Role-Based Access Gateway'}
          </p>
          <h1
            id="auth-heading"
            className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#131b2e]"
          >
            {isHi
              ? 'अपनी नागरिक भूमिका चुनें और लॉगिन या पंजीकरण करें'
              : 'Sign in or Register to Unlock Data Ingestion & Dashboards'}
          </h1>
          <p className="mt-1 text-sm text-[#3f493f]">
            {isHi
              ? 'लॉगिन के बाद डेटा अपलोड, स्वच्छता डैशबोर्ड, ब्रीफिंग और तुलना विकल्प खुलेंगे।'
              : 'Select whether you are acting as a Ward Officer, Housing Society (RWA), or School Administration.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onBackHome}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#131b2e] hover:bg-slate-50"
        >
          {isHi ? '← होम पेज पर लौटें' : '← Back to Home & Guidelines'}
        </button>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLE_CARDS.map((card) => {
          const active = selectedRole === card.role;
          const meta = ROLE_META[card.role];
          return (
            <button
              key={card.role}
              type="button"
              onClick={() => setSelectedRole(card.role)}
              aria-pressed={active}
              className={`text-left overflow-hidden rounded-2xl border transition-all ${
                active
                  ? 'border-[#15803d] ring-2 ring-[#16a34a]/25 bg-[#f0fdf4]/70'
                  : 'border-slate-200 bg-white hover:border-[#16a34a]/40'
              }`}
            >
              <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                <img
                  src={card.image}
                  alt={card.alt}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display text-base font-bold text-[#131b2e]">
                    <span className="text-[#15803d]">{card.icon}</span>
                    {meta.label}
                  </span>
                  {active && (
                    <span className="rounded-full bg-[#15803d] px-2 py-0.5 text-[10px] font-semibold text-white">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#3f493f] leading-relaxed">{meta.authoritySummary}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Login / Register Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="inline-flex rounded-xl bg-[#f2f3ff] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mode === 'login' ? 'bg-[#15803d] text-white shadow-sm' : 'text-[#3f493f]'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                {isHi ? 'लॉगिन (Login)' : 'Login'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mode === 'register' ? 'bg-[#15803d] text-white shadow-sm' : 'text-[#3f493f]'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {isHi ? 'पंजीकरण (Register)' : 'Register'}
              </button>
            </div>

            <span className="text-xs font-semibold text-[#00652c]">
              Role: {ROLE_META[selectedRole].label}
            </span>
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-[#3f493f]">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Ananya Sharma"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="auth-org" className="block text-xs font-semibold text-[#3f493f]">
                  {selectedRole === 'ward_officer'
                    ? 'Municipal Ward / Zone'
                    : selectedRole === 'housing_society'
                      ? 'Housing Society / RWA Name'
                      : 'School / Campus Name'}
                </label>
                <input
                  id="auth-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder={
                    selectedRole === 'ward_officer'
                      ? 'e.g., Ward 14 — Anand Vihar'
                      : selectedRole === 'housing_society'
                        ? 'e.g., Green Park RWA'
                        : 'e.g., Kendriya Vidyalaya Sector 11'
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-semibold text-[#3f493f]">
              Official or Personal Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-semibold text-[#3f493f]">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-[#ba1a1a]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00652c] disabled:opacity-60"
          >
            {mode === 'register'
              ? `Register & Enter as ${ROLE_META[selectedRole].label}`
              : `Login as ${ROLE_META[selectedRole].label}`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        {/* Instant Role Session Access for Evaluators */}
        <div className="lg:col-span-5 rounded-2xl border border-[#16a34a]/25 bg-[#f0fdf4]/70 p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#00652c]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-[#131b2e]">
              Quick Role Session Sign-In
            </h2>
          </div>
          <p className="text-xs text-[#3f493f] leading-relaxed">
            Evaluating Vayu AI? Launch an immediate authenticated session for any civic persona to
            test data ingestion, Recharts integrity dashboards, heatmaps, and role-scoped briefs.
          </p>

          <div className="space-y-2.5 pt-1">
            {(['ward_officer', 'housing_society', 'school'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleInstantRoleAccess(r)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#16a34a]/25 bg-white px-4 py-3 text-left transition-colors hover:bg-[#dcfce7]/50"
              >
                <div>
                  <p className="text-xs font-bold text-[#131b2e]">
                    Enter as {ROLE_META[r].label}
                  </p>
                  <p className="text-[11px] text-slate-500">{ROLE_META[r].shortTitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#15803d]" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
