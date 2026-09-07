import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import {
  downloadRepositoryPreviews,
  fetchGithubPreview,
} from '../scripts/github-preview.mjs';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

function pngChunk(type, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function validPreviewPng(marker = 1) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1200, 0);
  header.writeUInt32BE(600, 4);
  header[8] = 8;
  header[9] = 2;
  const scanlines = Buffer.alloc((1 + 1200 * 3) * 600);
  scanlines[1] = marker;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND'),
  ]);
}

function httpError(status, retryAfterMs) {
  const error = new Error(`Request failed: ${status}`);
  error.status = status;
  if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs;
  return error;
}

test('downloads each repository once with 750ms between unique request starts', async () => {
  const chaiPng = validPreviewPng(1);
  const boltzPng = validPreviewPng(2);
  const requests = [];
  const waits = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return url.endsWith('/chaidiscovery/chai-lab') ? chaiPng : boltzPng;
  };
  const wait = async (milliseconds) => waits.push(milliseconds);
  const tools = [
    { title: 'Chai-1', githubUrl: 'https://github.com/chaidiscovery/chai-lab' },
    { title: 'Chai Alias', githubUrl: 'https://github.com/ChaiDiscovery/CHAI-LAB' },
    { title: 'Boltz-2', githubUrl: 'https://github.com/jwohlwend/boltz' },
  ];

  const previews = await downloadRepositoryPreviews(tools, { fetch, wait });

  assert.equal(previews.size, 2);
  assert.strictEqual(previews.get('https://github.com/chaidiscovery/chai-lab'), chaiPng);
  assert.strictEqual(previews.get('https://github.com/jwohlwend/boltz'), boltzPng);
  assert.deepEqual(requests.map(({ url }) => url), [
    'https://opengraph.githubassets.com/ai4proteins/chaidiscovery/chai-lab',
    'https://opengraph.githubassets.com/ai4proteins/jwohlwend/boltz',
  ]);
  assert.ok(requests.every(({ options }) => (
    options.allowedOrigin === 'https://opengraph.githubassets.com'
    && options.maxBytes === 8 * 1024 * 1024
    && options.timeoutMs === 30_000
  )));
  assert.deepEqual(waits, [750]);
});

test('retries 429 and retryable server responses then returns the downloaded buffer', async () => {
  const preview = validPreviewPng();
  const responses = [httpError(429, 5000), httpError(500), preview];
  const waits = [];

  const result = await fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
    fetch: async () => {
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
    wait: async (milliseconds) => waits.push(milliseconds),
  });

  assert.strictEqual(result, preview);
  assert.deepEqual(waits, [5000, 2000]);
});

test('caps a Retry-After delay at 65 seconds', async () => {
  const preview = validPreviewPng();
  let attempts = 0;
  const waits = [];

  await fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) throw httpError(503, 70_000);
      return preview;
    },
    wait: async (milliseconds) => waits.push(milliseconds),
  });

  assert.deepEqual(waits, [65_000]);
});

test('makes no more than four total attempts', async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
      fetch: async () => {
        attempts += 1;
        throw httpError(500);
      },
      wait: async (milliseconds) => waits.push(milliseconds),
    }),
    /Request failed: 500/,
  );

  assert.equal(attempts, 4);
  assert.deepEqual(waits, [1000, 2000, 4000]);
});

test('does not retry an HTTP 404 response', async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
      fetch: async () => {
        attempts += 1;
        throw httpError(404);
      },
      wait: async (milliseconds) => waits.push(milliseconds),
    }),
    /Request failed: 404/,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});

test('does not retry an HTTP 501 response', async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
      fetch: async () => {
        attempts += 1;
        throw httpError(501);
      },
      wait: async (milliseconds) => waits.push(milliseconds),
    }),
    /Request failed: 501/,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});

test('does not retry an HTTP 505 response', async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
      fetch: async () => {
        attempts += 1;
        throw httpError(505);
      },
      wait: async (milliseconds) => waits.push(milliseconds),
    }),
    /Request failed: 505/,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});

test('does not retry a successful response containing an invalid PNG', async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchGithubPreview('https://github.com/chaidiscovery/chai-lab', {
      fetch: async () => {
        attempts += 1;
        return Buffer.from('<html>not a preview</html>');
      },
      wait: async (milliseconds) => waits.push(milliseconds),
    }),
    /invalid GitHub preview PNG/,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(waits, []);
});
