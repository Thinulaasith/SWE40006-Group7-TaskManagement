import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Read-only deployment checks. Never create accounts or change application data.
const settings = Object.fromEntries((await readFile(new URL('./compose.env', import.meta.url), 'utf8'))
  .split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
const origin = `http://127.0.0.1:${settings.APP_PORT || 8080}`;
async function request(path, status = 200, headers = {}) {
  const response = await fetch(new URL(path, origin), { headers, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, status, `${path}: unexpected HTTP status`);
  return response;
}
try {
  assert.equal((await (await request('/api/health')).json()).database, 'connected');
  await request('/api/health/live');
  const page = await request('/');
  assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  const html = await page.text();
  assert.match(html, /id="root"/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(path => path.endsWith('.js')) && assets.some(path => path.endsWith('.css')), 'Built assets are linked');
  for (const asset of assets) await request(asset);
  await request('/api/tasks', 401);
  await request('/api/metrics', 404);
  const metrics = await (await request('/api/metrics', 200, { Authorization: `Bearer ${settings.METRICS_TOKEN}` })).text();
  assert.match(metrics, /taskflow_http_requests_total \d+/);
  console.log('PASS: database health, built frontend/assets, security headers, API authentication and protected metrics');

  if (process.argv.includes('--monitoring')) {
    const endpoint = 'http://127.0.0.1:9090/api/v1';
    let healthy = false;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${endpoint}/query?query=${encodeURIComponent('up{job="taskflow"}')}`, { signal: AbortSignal.timeout(5000) });
        const query = await response.json();
        healthy = response.ok && query.status === 'success' && query.data.result.some(row => row.value[1] === '1');
      } catch {
        // The process may be running before its HTTP listener or first scrape is ready.
        healthy = false;
      }
      if (healthy) break;
      await delay(2000);
    }
    assert.ok(healthy, 'Prometheus must successfully scrape Taskflow');
    const rules = await (await fetch(`${endpoint}/rules`, { signal: AbortSignal.timeout(5000) })).json();
    assert.equal(rules.status, 'success');
    const names = rules.data.groups.flatMap(group => group.rules.map(rule => rule.name));
    for (const name of ['TaskflowUnavailable', 'TaskflowServerErrors']) assert.ok(names.includes(name), `${name} must be loaded`);
    console.log('PASS: Prometheus authenticated scrape and both alert rules');
  }
} catch (error) {
  console.error('Deployment verification failed:', error.message);
  process.exitCode = 1;
}
