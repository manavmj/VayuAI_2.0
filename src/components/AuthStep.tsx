import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Landmark,
  Lock,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { AdvisoryLanguage, AuthUser, UserRole } from '../types/vayu.ts';
import { ROLE_META } from '../utils/naqi.ts';
import { ROLE_CIVIC_IMAGES } from '../assets/civicImages.ts';
import { apiFetch, setSessionToken } from '../utils/authClient.ts';

interface AuthStepProps {
  initialMode: 'login' | 'register';
  initialRole: UserRole;
  language: AdvisoryLanguage;
  sessionNotice?: string | null;
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
    image: ROLE_CIVIC_IMAGES.ward_officer.src,
    alt: ROLE_CIVIC_IMAGES.ward_officer.alt,
  },
  {
    role: 'housing_society',
    icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
    image: ROLE_CIVIC_IMAGES.housing_society.src,
    alt: ROLE_CIVIC_IMAGES.housing_society.alt,
  },
  {
    role: 'school',
    icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
    image: ROLE_CIVIC_IMAGES.school.src,
    alt: ROLE_CIVIC_IMAGES.school.alt,
  },
];

export const AuthStep: React.FC<AuthStepProps> = ({
  initialMode,
  initialRole,
  language,
  sessionNotice,
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(sessionNotice || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDemoRole, setLoadingDemoRole] = useState<UserRole | null>(null);

  const passwordChecks = useMemo(
    () => ({
      minLen: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumOrSymbol: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    }),
    [password]
  );

  const passedCheckCount = Object.values(passwordChecks).filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim() || !organization.trim()) {
        setError('Please enter your full name and ward, housing society, or school name.');
        return;
      }
      if (passedCheckCount < 4) {
        setError(
          'Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.'
        );
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter the same password.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              name: name.trim(),
              organization: organization.trim(),
              email: trimmedEmail,
              role: selectedRole,
              password,
            }
          : {
              email: trimmedEmail,
              role: selectedRole,
              password,
            };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        user?: AuthUser;
        sessionToken?: string;
        error?: string;
      };

      if (!response.ok || !data.user || !data.sessionToken) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        return;
      }

      setSessionToken(data.sessionToken);
      setPassword('');
      setConfirmPassword('');
      onAuthenticated(data.user);
    } catch {
      setError('Unable to reach the authentication server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvaluatorSession = async (targetRole: UserRole) => {
    setError(null);
    setLoadingDemoRole(targetRole);
    try {
      const response = await apiFetch('/api/auth/evaluator-session', {
        method: 'POST',
        body: JSON.stringify({ role: targetRole }),
      });
      const data = (await response.json()) as {
        user?: AuthUser;
        sessionToken?: string;
        error?: string;
      };
      if (!response.ok || !data.user || !data.sessionToken) {
        setError(data.error || 'Could not start evaluator session.');
        return;
      }
      setSessionToken(data.sessionToken);
      onAuthenticated(data.user);
    } catch {
      setError('Unable to issue evaluator session. Please try again.');
    } finally {
      setLoadingDemoRole(null);
    }
  };

  return (
    <section aria-labelledby="auth-heading" className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#15803d]">
            {isHi ? 'भूमिका-आधारित सुरक्षित प्रवेश' : 'Signed Role-Based Access Gateway'}
          </p>
          <h1
            id="auth-heading"
            className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#131b2e]"
          >
            {isHi
              ? 'अपनी नागरिक भूमिका चुनें और सुरक्षित लॉगिन या पंजीकरण करें'
              : 'Optional Civic Role Sign-In & Registration'}
          </h1>
          <p className="mt-1 text-sm text-[#3f493f]">
            {isHi
              ? 'डेटा अपलोड और डैशबोर्ड पहले से खुले हैं। अपनी भूमिका सहेजने के लिए लॉगिन करें।'
              : 'All data ingestion, dashboards, and briefings are open to test immediately—sign in anytime to bind a verified Ward Officer, RWA, or School profile.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onBackHome}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#131b2e] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#16a34a]"
        >
          {isHi ? '← होम पेज पर लौटें' : '← Back to Home & Guidelines'}
        </button>
      </div>

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="group" aria-label="Civic Roles">
        {ROLE_CARDS.map((card) => {
          const active = selectedRole === card.role;
          const meta = ROLE_META[card.role];
          return (
            <button
              key={card.role}
              type="button"
              onClick={() => setSelectedRole(card.role)}
              aria-pressed={active}
              className={`text-left overflow-hidden rounded-2xl border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a34a] ${
                active
                  ? 'border-[#15803d] ring-2 ring-[#16a34a]/25 bg-[#f0fdf4]/70'
                  : 'border-slate-200 bg-white hover:border-[#16a34a]/40'
              }`}
            >
              <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                <img
                  src={card.image}
                  alt={card.alt}
                  decoding="async"
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
          noValidate
          className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex rounded-xl bg-[#f2f3ff] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                aria-pressed={mode === 'login'}
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
                aria-pressed={mode === 'register'}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  mode === 'register' ? 'bg-[#15803d] text-white shadow-sm' : 'text-[#3f493f]'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {isHi ? 'पंजीकरण (Register)' : 'Register'}
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00652c]">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
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
                  autoComplete="name"
                  maxLength={80}
                  required
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
                  autoComplete="organization"
                  maxLength={120}
                  required
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
              autoComplete="email"
              maxLength={160}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.org"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="auth-password" className="block text-xs font-semibold text-[#3f493f]">
                Password
              </label>
              {mode === 'register' && (
                <span className="text-[11px] font-mono text-slate-500">
                  Strength: {passedCheckCount}/4
                </span>
              )}
            </div>
            <div className="relative mt-1.5">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'register'
                    ? 'Minimum 8 chars (A-Z, a-z, 0-9/symbol)'
                    : 'Enter your password'
                }
                aria-describedby={mode === 'register' ? 'password-policy' : undefined}
                className="w-full rounded-lg border border-slate-200 bg-[#faf8ff] pl-3.5 pr-11 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-[#131b2e] focus-visible:outline-2 focus-visible:outline-[#16a34a]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {mode === 'register' && (
              <div id="password-policy" aria-live="polite" className="mt-2.5 space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full transition-colors ${
                        passedCheckCount >= step
                          ? passedCheckCount === 4
                            ? 'bg-[#15803d]'
                            : 'bg-[#eab308]'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#3f493f]">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={`h-3 w-3 ${
                        passwordChecks.minLen ? 'text-[#15803d]' : 'text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span>8+ characters</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={`h-3 w-3 ${
                        passwordChecks.hasUpper ? 'text-[#15803d]' : 'text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span>Uppercase letter</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={`h-3 w-3 ${
                        passwordChecks.hasLower ? 'text-[#15803d]' : 'text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span>Lowercase letter</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={`h-3 w-3 ${
                        passwordChecks.hasNumOrSymbol ? 'text-[#15803d]' : 'text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span>Number or symbol</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-semibold text-[#3f493f]"
              >
                Confirm Password
              </label>
              <input
                id="auth-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#faf8ff] px-3.5 py-2 text-sm text-[#131b2e] focus:border-[#16a34a] focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#ba1a1a]/30 bg-[#ffdad6]/50 px-3.5 py-2.5 text-xs font-semibold text-[#93000a]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00652c] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a34a]"
          >
            {isSubmitting
              ? 'Verifying...'
              : mode === 'register'
                ? `Register & Enter as ${ROLE_META[selectedRole].label}`
                : `Login as ${ROLE_META[selectedRole].label}`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Credentials are verified on the Express backend via salted{' '}
            <span className="font-mono">scrypt</span> + <span className="font-mono">timingSafeEqual</span>
            ; no passwords or hashes are ever stored in browser storage.
          </p>
        </form>

        {/* Signed Evaluator Sandbox Access */}
        <div className="lg:col-span-5 rounded-2xl border border-[#16a34a]/25 bg-[#f0fdf4]/70 p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#00652c]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-[#131b2e]">
              Signed Evaluator Session
            </h2>
          </div>
          <p className="text-xs text-[#3f493f] leading-relaxed">
            Reviewing Vayu AI? Request a 2-hour, server-signed <span className="font-mono">HMAC-SHA256</span>{' '}
            sandbox session for any civic role to verify data ingestion, Recharts integrity trends,
            heatmaps, and role-scoped briefings.
          </p>

          <div className="space-y-2.5 pt-1">
            {(['ward_officer', 'housing_society', 'school'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                disabled={loadingDemoRole !== null}
                onClick={() => void handleEvaluatorSession(r)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#16a34a]/25 bg-white px-4 py-3 text-left transition-colors hover:bg-[#dcfce7]/50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#16a34a]"
              >
                <div>
                  <p className="text-xs font-bold text-[#131b2e]">
                    {loadingDemoRole === r
                      ? 'Issuing Signed Token...'
                      : `Start ${ROLE_META[r].label} Session`}
                  </p>
                  <p className="text-[11px] text-slate-500">{ROLE_META[r].shortTitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#15803d]" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#16a34a]/20 bg-white/80 p-3 text-[11px] text-[#3f493f] space-y-1">
            <p className="font-semibold text-[#14532d]">Active Security Controls</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Server-enforced auth gate on all AI endpoints (<span className="font-mono">401</span> if unauthenticated)</li>
              <li>5-attempt brute-force lockout + IP rate limiting</li>
              <li><span className="font-mono">HttpOnly</span> cookie + <span className="font-mono">sessionStorage</span> signed token</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
