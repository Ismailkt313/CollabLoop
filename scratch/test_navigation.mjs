/**
 * Phase 7.1: Browser Refresh Navigation Fix - Verification Tests
 * Tests the URL-based project routing: direct access, refresh persistence,
 * authorization enforcement, and error handling.
 */

const API_BASE = 'http://127.0.0.1:5000/api';
const ts = Date.now();

async function runTests() {
  console.log('================================================================');
  console.log('  CollabLoop: URL-Based Project Navigation Verification Tests');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
    }
  };

  const assert = (cond, msg) => { if (!cond) throw new Error(`Assertion failed: ${msg}`); };

  // ── Setup: Create test users and project ──────────────────────────────────
  console.log('\n--- 1. User & Project Setup ---');

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'NavTest Owner', username: `navowner_${ts}`, email: `navowner_${ts}@test.com`, password: 'password123', confirmPassword: 'password123' }),
  });
  const ownerCookie = regRes.headers.get('set-cookie');
  const ownerData = await regRes.json();
  const ownerHeaders = { 'Content-Type': 'application/json', Cookie: ownerCookie || '' };

  await test('Owner registered', () => {
    assert(regRes.status === 201, `Expected 201, got ${regRes.status}`);
  });

  // Register outsider
  const outsiderRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'NavTest Outsider', username: `navoutsider_${ts}`, email: `navoutsider_${ts}@test.com`, password: 'password123', confirmPassword: 'password123' }),
  });
  const outsiderCookie = outsiderRes.headers.get('set-cookie');
  const outsiderHeaders = { 'Content-Type': 'application/json', Cookie: outsiderCookie || '' };

  await test('Outsider registered', () => {
    assert(outsiderRes.status === 201, `Expected 201, got ${outsiderRes.status}`);
  });

  // Create project
  const projRes = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ name: `NavTest Project ${ts}`, description: 'URL navigation test project', category: 'Testing' }),
  });
  const projData = await projRes.json();
  const projectId = projData.project?._id || projData.project?.id;

  await test('Project created', () => {
    assert(projRes.status === 201 && projectId, 'Project must be created with valid ID');
  });

  // ── 2. Direct project access via API (simulates URL-based fetch) ──────────
  console.log('\n--- 2. Direct Project Access via GET /api/projects/:id ---');

  await test('Owner can fetch project by ID', async () => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, { headers: ownerHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.project || data._id || data.name, 'Response must contain project data');
  });

  await test('Outsider gets 403 on project by ID', async () => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, { headers: outsiderHeaders });
    assert(res.status === 403 || res.status === 404, `Expected 403 or 404, got ${res.status}`);
  });

  await test('Unauthenticated request gets 401', async () => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('Invalid project ID returns 400 or 404', async () => {
    const res = await fetch(`${API_BASE}/projects/invalid-id-string`, { headers: ownerHeaders });
    assert(res.status === 400 || res.status === 404, `Expected 400 or 404, got ${res.status}`);
  });

  await test('Nonexistent valid ObjectId returns 403 or 404', async () => {
    const res = await fetch(`${API_BASE}/projects/aaaaaaaaaaaaaaaaaaaaaaaa`, { headers: ownerHeaders });
    assert(res.status === 403 || res.status === 404, `Expected 403 or 404, got ${res.status}`);
  });

  // ── 3. Project workspaces endpoint (used by ProjectDetailLanding) ─────────
  console.log('\n--- 3. Project Workspaces Endpoint (Refresh Data Source) ---');

  await test('Owner can fetch project workspaces by ID', async () => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/workspaces`, { headers: ownerHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.project, 'Must return project field');
    assert(data.membership, 'Must return membership field');
  });

  await test('Outsider blocked from project workspaces', async () => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/workspaces`, { headers: outsiderHeaders });
    assert(res.status === 403 || res.status === 404, `Expected 403 or 404, got ${res.status}`);
  });

  // ── 4. Health check still works ───────────────────────────────────────────
  console.log('\n--- 4. Health & Regression ---');

  await test('Health check returns 200', async () => {
    const res = await fetch(`${API_BASE}/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ── 5. Second project to verify isolation ─────────────────────────────────
  console.log('\n--- 5. Multi-Project URL Isolation ---');

  const proj2Res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ name: `NavTest B ${ts}`, description: 'Second URL test project', category: 'Testing' }),
  });
  const proj2Data = await proj2Res.json();
  const project2Id = proj2Data.project?._id || proj2Data.project?.id;

  await test('Project B created', () => {
    assert(proj2Res.status === 201 && project2Id, 'Project B must be created');
  });

  await test('Project A and B have distinct IDs', () => {
    assert(projectId !== project2Id, 'Project IDs must be different');
  });

  await test('Owner can access Project A by ID', async () => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, { headers: ownerHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const name = data.project?.name || data.name;
    assert(name && name.includes('NavTest Project'), `Expected NavTest Project, got ${name}`);
  });

  await test('Owner can access Project B by ID', async () => {
    const res = await fetch(`${API_BASE}/projects/${project2Id}`, { headers: ownerHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const name = data.project?.name || data.name;
    assert(name && name.includes('NavTest B'), `Expected NavTest B, got ${name}`);
  });

  // ── Results ───────────────────────────────────────────────────────────────
  console.log(`\n================================================================`);
  console.log(`  Navigation Tests Complete: ${passed}/${total} PASSED`);
  console.log(`================================================================`);
  if (passed !== total) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
