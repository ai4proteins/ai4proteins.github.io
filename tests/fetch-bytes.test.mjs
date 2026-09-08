import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchBytes } from '../scripts/fetch-bytes.mjs';

async function serve(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    }),
  };
}

function holdResponseOpen(response, status, headers = {}) {
  const closed = new Promise((resolve) => response.once('close', resolve));
  const interval = setInterval(() => response.write('still open'), 25);
  response.once('close', () => clearInterval(interval));
  response.writeHead(status, headers);
  response.write('discarded body');
  return closed;
}

async function assertResponseClosedPromptly(closed) {
  const result = await Promise.race([
    closed.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 200)),
  ]);
  assert.equal(result, true, 'discarded response body must be canceled promptly');
}

test('follows a same-origin redirect and returns the response bytes', async (t) => {
  const requests = [];
  let redirectClosed;
  const server = await serve((request, response) => {
    requests.push(request.url);
    if (request.url === '/start') {
      redirectClosed = holdResponseOpen(response, 302, { location: '/catalog' });
      return;
    }
    response.end('catalog bytes');
  });
  t.after(server.close);

  const bytes = await fetchBytes(`${server.origin}/start`, {
    allowedOrigin: server.origin,
    maxBytes: 1024,
    timeoutMs: 1000,
  });

  assert.equal(bytes.toString(), 'catalog bytes');
  assert.deepEqual(requests, ['/start', '/catalog']);
  await assertResponseClosedPromptly(redirectClosed);
});

test('rejects a cross-origin redirect without requesting its target', async (t) => {
  let targetRequests = 0;
  const target = await serve((_request, response) => {
    targetRequests += 1;
    response.end('must not be requested');
  });
  t.after(target.close);
  let redirectClosed;
  const source = await serve((_request, response) => {
    redirectClosed = holdResponseOpen(response, 302, { location: `${target.origin}/escaped` });
  });
  t.after(source.close);

  await assert.rejects(
    fetchBytes(`${source.origin}/start`, {
      allowedOrigin: source.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    /allowed origin/,
  );
  assert.equal(targetRequests, 0);
  await assertResponseClosedPromptly(redirectClosed);
});

test('cancels an HTTP error response before rejecting it', async (t) => {
  let responseClosed;
  const server = await serve((_request, response) => {
    responseClosed = holdResponseOpen(response, 503);
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/unavailable`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    /Request failed: 503/,
  );
  await assertResponseClosedPromptly(responseClosed);
});

test('HTTP errors expose status and seconds-form Retry-After metadata', async (t) => {
  const server = await serve((_request, response) => {
    response.writeHead(429, { 'retry-after': '2' }).end('rate limited');
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/rate-limited`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterMs, 2000);
      return true;
    },
  );
});

test('HTTP errors parse date-form Retry-After metadata into a numeric delay', async (t) => {
  const retryAt = new Date(Date.now() + 3000).toUTCString();
  const server = await serve((_request, response) => {
    response.writeHead(503, { 'retry-after': retryAt }).end('unavailable');
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/temporarily-unavailable`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(typeof error.retryAfterMs, 'number');
      assert.ok(error.retryAfterMs >= 1500 && error.retryAfterMs <= 3000);
      return true;
    },
  );
});

test('HTTP errors omit retry delay metadata when Retry-After is malformed', async (t) => {
  const server = await serve((_request, response) => {
    response.writeHead(500, { 'retry-after': 'eventually' }).end('failed');
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/failed`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.retryAfterMs, undefined);
      return true;
    },
  );
});

test('applies one timeout while reading the response body', async (t) => {
  const server = await serve((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.write('partial');
    setTimeout(() => response.end('late'), 250);
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/slow`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 50,
    }),
    /timeout|abort/i,
  );
});

test('rejects a declared body larger than the maximum', async (t) => {
  let responseClosed;
  const server = await serve((_request, response) => {
    responseClosed = holdResponseOpen(response, 200, { 'content-length': '2048' });
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/declared-large`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    /maximum of 1024 bytes/,
  );
  await assertResponseClosedPromptly(responseClosed);
});

test('rejects a streamed body once it exceeds the maximum', async (t) => {
  const server = await serve((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.write(Buffer.alloc(700));
    response.end(Buffer.alloc(700));
  });
  t.after(server.close);

  await assert.rejects(
    fetchBytes(`${server.origin}/streamed-large`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    /maximum of 1024 bytes/,
  );
});

test('follows at most five redirects', async (t) => {
  const server = await serve((request, response) => {
    const [, mode, stepText] = new URL(request.url, 'http://localhost').pathname.split('/');
    const step = Number(stepText);
    if (mode === 'allowed' && step === 5) {
      response.end('five redirects succeeded');
      return;
    }
    response.writeHead(302, { location: `/${mode}/${step + 1}` }).end();
  });
  t.after(server.close);

  const bytes = await fetchBytes(`${server.origin}/allowed/0`, {
    allowedOrigin: server.origin,
    maxBytes: 1024,
    timeoutMs: 1000,
  });
  assert.equal(bytes.toString(), 'five redirects succeeded');

  await assert.rejects(
    fetchBytes(`${server.origin}/excess/0`, {
      allowedOrigin: server.origin,
      maxBytes: 1024,
      timeoutMs: 1000,
    }),
    /more than 5 redirects/,
  );
});
