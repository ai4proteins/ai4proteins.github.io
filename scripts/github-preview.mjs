import { isGithubPreviewPng } from './catalog-image.mjs';
import { githubPreviewUrl, githubRepositoryParts } from './catalog-source.mjs';
import { fetchBytes } from './fetch-bytes.mjs';

const PREVIEW_ORIGIN = 'https://opengraph.githubassets.com';
const PREVIEW_MAX_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_SPACING_MS = 750;
const MAX_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 65_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function waitFor(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function repositoryKey(repositoryUrl) {
  const { owner, repository } = githubRepositoryParts(repositoryUrl);
  return `https://github.com/${owner.toLowerCase()}/${repository.toLowerCase()}`;
}

function isRetryable(error) {
  return RETRYABLE_STATUSES.has(error?.status);
}

export async function fetchGithubPreview(repositoryUrl, {
  fetch = fetchBytes,
  wait = waitFor,
} = {}) {
  const previewUrl = githubPreviewUrl(repositoryUrl);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const payload = await fetch(previewUrl, {
        allowedOrigin: PREVIEW_ORIGIN,
        maxBytes: PREVIEW_MAX_BYTES,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      if (!isGithubPreviewPng(payload)) {
        throw new Error(`Image request returned invalid GitHub preview PNG for ${repositoryUrl}`);
      }
      return payload;
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) throw error;

      const backoffMs = 1000 * (2 ** attempt);
      const retryAfterMs = Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0
        ? error.retryAfterMs
        : 0;
      await wait(Math.min(MAX_RETRY_DELAY_MS, Math.max(backoffMs, retryAfterMs)));
    }
  }

  throw new Error('Unreachable preview retry state');
}

export async function downloadRepositoryPreviews(tools, {
  fetch = fetchBytes,
  wait = waitFor,
} = {}) {
  const repositories = new Map();
  for (const tool of tools) {
    const key = repositoryKey(tool.githubUrl);
    if (!repositories.has(key)) repositories.set(key, tool.githubUrl);
  }

  const previews = new Map();
  let firstRequest = true;
  for (const [key, repositoryUrl] of repositories) {
    if (!firstRequest) await wait(REQUEST_SPACING_MS);
    firstRequest = false;
    const preview = await fetchGithubPreview(repositoryUrl, { fetch, wait });
    previews.set(key, preview);
  }
  return previews;
}
