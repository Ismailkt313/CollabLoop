import assert from 'node:assert/strict';
import config, { validateConfig } from '../server/src/config/index.js';
import { cookieOptions, hashPassword, passwordDigest } from '../server/src/utils/auth.js';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('--- Starting Phase 7: Production Readiness Verification ---');
  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(err);
    }
  };

  // 1. Health check endpoint readiness & payload structure
  await test('GET /api/health returns 200 with DB status and uptime', async () => {
    const res = await fetch(`${API_BASE}/health`);
    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.database, 'connected');
    assert.ok(typeof data.uptime === 'number');
    assert.ok(data.timestamp);
  });

  // 2. Helmet Security Headers
  await test('Server sends security headers via Helmet', async () => {
    const res = await fetch(`${API_BASE}/health`);
    const nosniff = res.headers.get('x-content-type-options');
    assert.strictEqual(nosniff, 'nosniff', 'Missing X-Content-Type-Options: nosniff');
  });

  // 3. CORS Preflight & Credentials
  await test('CORS allows authorized client origin and credentials', async () => {
    const res = await fetch(`${API_BASE}/health`, {
      headers: {
        Origin: 'http://localhost:2345',
      },
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    const allowCredentials = res.headers.get('access-control-allow-credentials');
    assert.strictEqual(allowOrigin, 'http://localhost:2345');
    assert.strictEqual(allowCredentials, 'true');
  });

  // 4. Rate Limiting on Authentication Endpoints
  await test('Auth rate limiter enforces threshold and responds with 429 when exceeded', async () => {
    // Send 30 requests rapidly to /api/auth/login to exceed the 25 limit
    let hitRateLimit = false;
    for (let i = 0; i < 35; i++) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@test.com', password: 'randompassword' }),
      });
      if (res.status === 429) {
        hitRateLimit = true;
        const data = await res.json();
        assert.ok(data.error.includes('Too many authentication attempts'));
        break;
      }
    }
    assert.ok(hitRateLimit, 'Rate limiter did not trigger 429 status on rapid auth requests');
  });

  // 5. Cookie configuration security attributes
  await test('cookieOptions enforces httpOnly, path, and maxAge', async () => {
    assert.strictEqual(cookieOptions.httpOnly, true);
    assert.strictEqual(cookieOptions.path, '/');
    assert.strictEqual(cookieOptions.maxAge, 7 * 864e5);
    assert.ok('secure' in cookieOptions);
    assert.ok('sameSite' in cookieOptions);
  });

  // 6. Password Hashing Security (sha256-bcrypt scheme)
  await test('Password hashing uses sha256-bcrypt scheme with 12 rounds', async () => {
    const testPassword = 'ProductionPassword#2026';
    const digest = passwordDigest(testPassword);
    assert.strictEqual(digest.length, 64, 'Digest should be 64-char hex SHA-256');

    const hash = await hashPassword(testPassword);
    assert.ok(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$'), 'Hash should use bcrypt cost factor 12');
  });

  // 7. Environment Validation Function Tests
  await test('validateConfig validates production JWT requirements correctly', () => {
    // Current test run is in development, validateConfig() should pass cleanly
    assert.doesNotThrow(() => validateConfig());
  });

  console.log(`\nPhase 7 Test Results: ${passed}/${total} passed`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
