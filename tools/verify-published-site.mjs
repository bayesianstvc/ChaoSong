import { readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_URL = 'https://bayesianstvc.github.io/ChaoSong/release.json';
const maxResponseBytes = 64 * 1024;

function validateIdentity(release) {
  if (release?.formatVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(release.generation ?? '') ||
      !/^[a-f0-9]{40}$/.test(release.rendererRevision ?? '')) {
    throw new Error('Invalid release identity');
  }
  return release;
}

async function readRelease(response) {
  if (!response.ok) throw new Error(`Release request returned HTTP ${response.status}`);
  if (!response.body) throw new Error('Release response has no body');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxResponseBytes) throw new Error('Release metadata exceeded 64 KiB');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return validateIdentity(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}

/** Read-only, bounded verification. It never retries or rolls back deployment. */
export async function verifyPublishedRelease(candidate, {
  fetchImpl = globalThis.fetch,
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  log = console.log,
  attempts = 8,
  intervalMs = 10_000,
  timeoutMs = 10_000,
} = {}) {
  validateIdentity(candidate);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 8 ||
      !Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 10_000 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new Error('Invalid bounded verification settings');
  }
  let lastFailure = 'No verification attempt completed';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // A unique query avoids comparing a previously cached release manifest.
      const url = new URL(RELEASE_URL);
      url.searchParams.set('verify', `${candidate.rendererRevision}-${Date.now()}-${attempt}`);
      const response = await fetchImpl(url.toString(), {
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const live = await readRelease(response);
      if (live.generation !== candidate.generation || live.rendererRevision !== candidate.rendererRevision) {
        throw new Error('Published generation or renderer revision does not yet match the candidate');
      }
      log(`PUBLISHED_RELEASE_VERIFIED ${candidate.generation} ${candidate.rendererRevision}`);
      return { generation: live.generation, rendererRevision: live.rendererRevision, attempts: attempt };
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : 'Release verification failed';
      log(`PUBLIC_RELEASE_CHECK ${attempt}/${attempts}: ${lastFailure}`);
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  throw new Error(`Published release verification failed after ${attempts} attempts: ${lastFailure}. Deployment may already be live; inspect Pages before retrying.`);
}

const invokedPath = process.argv[1] && path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidate = JSON.parse(await readFile(path.join(root, '.build', 'candidate-release.json'), 'utf8'));
  const result = await verifyPublishedRelease(candidate);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `Published release verified against the current candidate after ${result.attempts} check(s).\n\n` +
      `Generation: \`${result.generation}\`\n\nRenderer: \`${result.rendererRevision}\`\n`);
  }
}
