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

test('follows a same-origin redirect and returns the response bytes', async (t) => {
  const requests = [];
  const server = await serve((request, response) => {
    requests.push(request.url);
    if (request.url === '/start') {
      response.writeHead(302, { location: '/catalog' }).end();
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
});

test('rejects a cross-origin redirect without requesting its target', async (t) => {
  let targetRequests = 0;
  const target = await serve((_request, response) => {
    targetRequests += 1;
    response.end('must not be requested');
  });
  t.after(target.close);
  const source = await serve((_request, response) => {
    response.writeHead(302, { location: `${target.origin}/escaped` }).end();
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
  const server = await serve((_request, response) => {
    response.writeHead(200, { 'content-length': '2048' });
    response.end('small');
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
