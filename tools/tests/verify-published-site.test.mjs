import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RELEASE_URL, verifyPublishedRelease } from '../verify-published-site.mjs';

const candidate = { formatVersion: 1, generation: 'a'.repeat(64), rendererRevision: 'b'.repeat(40) };
const asResponse = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const silent = () => {};

test('checks the fixed public release identity without sending credentials', async () => {
  const result = await verifyPublishedRelease(candidate, {
    fetchImpl: async (address, options) => {
      const url = new URL(address);
      assert.equal(url.origin + url.pathname, RELEASE_URL);
      assert.ok(url.searchParams.has('verify'));
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal instanceof AbortSignal);
      return asResponse(candidate);
    },
    sleep: () => assert.fail('Matching release must not wait'), log: silent,
  });
  assert.deepEqual(result, { generation: candidate.generation, rendererRevision: candidate.rendererRevision, attempts: 1 });
});

test('waits for both the generation and renderer to match', async () => {
  const releases = [
    { ...candidate, generation: 'c'.repeat(64) },
    { ...candidate, rendererRevision: 'd'.repeat(40) },
    candidate,
  ];
  const waits = [];
  const result = await verifyPublishedRelease(candidate, {
    fetchImpl: async () => asResponse(releases.shift()),
    sleep: async milliseconds => waits.push(milliseconds), log: silent,
  });
  assert.equal(result.attempts, 3);
  assert.deepEqual(waits, [10_000, 10_000]);
});

test('bounds transient HTTP and network failures without an extra final wait', async () => {
  let requests = 0;
  let waits = 0;
  await assert.rejects(verifyPublishedRelease(candidate, {
    attempts: 3,
    fetchImpl: async () => {
      requests++;
      if (requests === 1) return new Response('Unavailable', { status: 503 });
      throw new Error('Request timed out');
    },
    sleep: async () => { waits++; }, log: silent,
  }), /failed after 3 attempts.*Deployment may already be live/);
  assert.equal(requests, 3);
  assert.equal(waits, 2);
});

test('rejects malformed or oversized public metadata', async () => {
  for (const response of [
    new Response('not JSON'),
    asResponse({ ...candidate, formatVersion: 2 }),
    new Response(' '.repeat(64 * 1024 + 1)),
  ]) {
    await assert.rejects(verifyPublishedRelease(candidate, {
      attempts: 1, fetchImpl: async () => response, log: silent,
    }), /verification failed after 1 attempts/);
  }
});

test('rejects invalid candidates and unbounded settings before any request', async () => {
  const fetchImpl = () => assert.fail('Invalid input must not reach the network');
  await assert.rejects(verifyPublishedRelease({ ...candidate, generation: 'invalid' }, { fetchImpl }), /Invalid release identity/);
  for (const settings of [{ attempts: 9 }, { attempts: 0 }, { intervalMs: 10_001 }, { timeoutMs: 10_001 }]) {
    await assert.rejects(verifyPublishedRelease(candidate, { fetchImpl, ...settings }), /Invalid bounded verification settings/);
  }
});

function assertWeeklyScheduleContract(source) {
  const workflow = source.replace(/\r\n/g, '\n');
  const begin = '  # BEGIN CHAOSONG_STUDIO_WEEKLY_SCHEDULE_V1';
  const end = '  # END CHAOSONG_STUDIO_WEEKLY_SCHEDULE_V1';
  assert.equal(workflow.split(begin).length - 1, 1);
  assert.equal(workflow.split(end).length - 1, 1);
  const start = workflow.indexOf(begin), finish = workflow.indexOf(end) + end.length;
  assert.ok(start < finish && (start === 0 || workflow[start - 1] === '\n'));
  assert.ok(finish === workflow.length || workflow[finish] === '\n');
  const block = workflow.slice(start, finish);
  const outside = workflow.slice(0, start) + workflow.slice(finish);
  const metadata = block.match(/^  # studio-weekly: (\{[^\n]*\})$/m);
  assert.ok(metadata, 'Weekly metadata must be present');
  const settings = JSON.parse(metadata[1]);
  assert.deepEqual(Object.keys(settings).sort(), ['enabled', 'time', 'timezone', 'weekday']);
  assert.equal(typeof settings.enabled, 'boolean');
  assert.ok(Number.isInteger(settings.weekday) && settings.weekday >= 0 && settings.weekday <= 6);
  assert.match(settings.time, /^([01]\d|2[0-3]):[0-5]\d$/);
  assert.equal(settings.timezone, 'Asia/Shanghai');
  // Use a UTC date to check the exported cron, including the previous-day rollover.
  const utc = new Date(`2026-09-${String(6 + settings.weekday).padStart(2, '0')}T${settings.time}:00+08:00`);
  const cron = `${utc.getUTCMinutes()} ${utc.getUTCHours()} * * ${utc.getUTCDay()}`;
  assert.equal(block, [begin, `  # studio-weekly: ${JSON.stringify(settings)}`,
    ...(settings.enabled ? ['  schedule:', `    - cron: '${cron}'`] : []), end].join('\n'));
  assert.doesNotMatch(outside, /^\s*['"]?schedule['"]?\s*:/m);
  assert.match(outside, /^  workflow_dispatch:\n/m);
}

test('weekly schedule contract accepts changed settings and disabled schedules', () => {
  const fixture = (settings, cron) => [
    'on:', '  workflow_dispatch:',
    '  # BEGIN CHAOSONG_STUDIO_WEEKLY_SCHEDULE_V1',
    `  # studio-weekly: ${JSON.stringify(settings)}`,
    ...(cron === null ? [] : ['  schedule:', `    - cron: '${cron}'`]),
    '  # END CHAOSONG_STUDIO_WEEKLY_SCHEDULE_V1', '',
  ].join('\n');
  for (const [settings, cron] of [
    [{ enabled: true, weekday: 3, time: '17:22', timezone: 'Asia/Shanghai' }, '22 9 * * 3'],
    [{ enabled: true, weekday: 0, time: '00:07', timezone: 'Asia/Shanghai' }, '7 16 * * 6'],
    [{ enabled: false, weekday: 5, time: '12:37', timezone: 'Asia/Shanghai' }, null],
  ]) {
    assertWeeklyScheduleContract(fixture(settings, cron));
    assertWeeklyScheduleContract(fixture(settings, cron).replace(/\n/g, '\r\n'));
  }
  const settings = { enabled: true, weekday: 1, time: '09:07', timezone: 'Asia/Shanghai' };
  const valid = fixture(settings, '7 1 * * 1');
  for (const invalid of [
    fixture(settings, '7 9 * * 1'),
    fixture({ ...settings, enabled: false }, '7 1 * * 1'),
    fixture(settings, null),
    fixture({ ...settings, weekday: 7 }, '7 1 * * 0'),
    fixture({ ...settings, time: '24:07' }, '7 16 * * 1'),
    fixture({ ...settings, timezone: 'UTC' }, '7 1 * * 1'),
    valid + "  'schedule':\n    - cron: '7 * * * *'\n",
    valid.replace('  workflow_dispatch:\n', ''),
    valid + '  # BEGIN CHAOSONG_STUDIO_WEEKLY_SCHEDULE_V1\n',
  ]) assert.throws(() => assertWeeklyScheduleContract(invalid));
});

test('workflow keeps a valid Studio weekly schedule and performs verification only after changed deployments', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/sync.yml', import.meta.url), 'utf8');
  assertWeeklyScheduleContract(workflow);
  const verifyIndex = workflow.indexOf('- name: Verify the published GitHub Pages release');
  assert.ok(verifyIndex > workflow.indexOf('uses: actions/deploy-pages@v4'));
  assert.match(workflow.slice(verifyIndex), /if: steps\.sync\.outputs\.changed == 'true'\n        run: node tools\/verify-published-site\.mjs/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /STUDIO_REQUEST_ID: \$\{\{ inputs\.request_id \}\}/);
  assert.match(workflow, /run-name: Sites sync \/ \$\{\{ inputs\.request_id \|\| github\.event_name \}\}/);
});
