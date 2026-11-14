import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server.ts';

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('GET /api/health returns 200 ok with no-store and hardened security headers', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    const json = (await res.json()) as { ok: boolean; service: string };
    assert.equal(json.ok, true);
    assert.equal(json.service, 'vayu-ai');
  });
});

test('All workflow API routes are accessible pre-login and enforce strict input validation (400, not 401)', async () => {
  await withServer(async (base) => {
    const checks: Array<{ path: string; body: unknown }> = [
      { path: '/api/normalize', body: { sourceRows: [] } },
      {
        path: '/api/normalize',
        body: {
          sourceRows: Array.from({ length: 151 }, (_, i) => ({
            rowIndex: i + 1,
            rawText: 'row',
            rawFields: {},
          })),
        },
      },
      { path: '/api/brief', body: {} },
      { path: '/api/advisory', body: {} },
      { path: '/api/compare', body: {} },
      { path: '/api/brief-all-roles', body: {} },
      { path: '/api/pawan', body: { message: '   ' } },
    ];

    for (const check of checks) {
      const res = await fetch(`${base}${check.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(check.body),
      });
      assert.equal(res.status, 400, `Expected 400 on ${check.path}, got ${res.status}`);
    }
  });
});

test('Optional register, login, duplicate email check, session /me, and logout lifecycle work over HTTP', async () => {
  await withServer(async (base) => {
    const uniqueEmail = `ward.${Date.now()}@vayu.civic`;
    const regRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Asha Verma',
        organization: 'Ward 14 Municipal',
        email: uniqueEmail,
        role: 'ward_officer',
        password: 'CivicPassword#2026',
      }),
    });
    assert.equal(regRes.status, 201);
    const regJson = (await regRes.json()) as { user: { email: string; role: string }; sessionToken: string };
    assert.equal(regJson.user.email, uniqueEmail);
    assert.ok(regJson.sessionToken);
    assert.ok(regRes.headers.get('set-cookie')?.includes('HttpOnly'));

    // Duplicate registration rejected cleanly with 409
    const dupRes = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Asha Verma',
        organization: 'Ward 14 Municipal',
        email: uniqueEmail,
        role: 'ward_officer',
        password: 'CivicPassword#2026',
      }),
    });
    assert.equal(dupRes.status, 409);

    // Bearer session resolves /api/auth/me
    const meRes = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${regJson.sessionToken}` },
    });
    assert.equal(meRes.status, 200);
    const meJson = (await meRes.json()) as { user: { email: string } | null };
    assert.equal(meJson.user?.email, uniqueEmail);

    // Login with registered credentials succeeds
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        role: 'ward_officer',
        password: 'CivicPassword#2026',
      }),
    });
    assert.equal(loginRes.status, 200);

    // Logout clears cookie cleanly
    const logoutRes = await fetch(`${base}/api/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);
    assert.ok(logoutRes.headers.get('set-cookie')?.includes('Max-Age=0'));
  });
});

test('Evaluator sandbox session issues signed HttpOnly cookie & Bearer token and enforces /api/auth/session-check', async () => {
  await withServer(async (base) => {
    const evalRes = await fetch(`${base}/api/auth/evaluator-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'school' }),
    });
    assert.equal(evalRes.status, 200);
    const evalJson = (await evalRes.json()) as {
      user: { role: string; isDemo?: boolean };
      sessionToken: string;
    };
    assert.equal(evalJson.user.role, 'school');
    assert.equal(evalJson.user.isDemo, true);
    assert.ok(evalJson.sessionToken);
    assert.ok(evalRes.headers.get('set-cookie')?.includes('HttpOnly'));

    const checkOk = await fetch(`${base}/api/auth/session-check`, {
      headers: { Authorization: `Bearer ${evalJson.sessionToken}` },
    });
    assert.equal(checkOk.status, 200);

    const checkFail = await fetch(`${base}/api/auth/session-check`);
    assert.equal(checkFail.status, 401);
  });
});

test('HTTP login enforces brute-force lockout (429 + Retry-After) after 5 failed attempts', async () => {
  await withServer(async (base) => {
    const email = `brute.${Date.now()}@vayu.civic`;
    for (let i = 1; i <= 4; i += 1) {
      const r = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'housing_society', password: 'WrongPassword#1' }),
      });
      assert.equal(r.status, 401);
    }

    const fifth = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: 'housing_society', password: 'WrongPassword#1' }),
    });
    assert.equal(fifth.status, 429);
    assert.ok(fifth.headers.get('retry-after'));
  });
});
