import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server.ts';

test('Express app exposes open pre-login validation, security headers, and optional signed auth lifecycle', async () => {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    // 1. Pre-login /api/normalize validates input (400, NOT 401) and sets security headers
    const normRes = await fetch(`${base}/api/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceRows: [] }),
    });
    assert.equal(normRes.status, 400);
    assert.equal(normRes.headers.get('x-powered-by'), null);
    assert.equal(normRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(normRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

    // 2. Pre-login /api/brief validates payload cleanly without login wall
    const briefRes = await fetch(`${base}/api/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(briefRes.status, 400);

    // 3. Evaluator sandbox session issues signed HttpOnly cookie & Bearer token
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

    // 4. Protected session-check passes with Bearer token and fails without token
    const checkOk = await fetch(`${base}/api/auth/session-check`, {
      headers: { Authorization: `Bearer ${evalJson.sessionToken}` },
    });
    assert.equal(checkOk.status, 200);

    const checkFail = await fetch(`${base}/api/auth/session-check`);
    assert.equal(checkFail.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
