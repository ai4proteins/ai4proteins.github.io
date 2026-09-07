const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function retryAfterMilliseconds(value) {
  if (value === null) return undefined;
  if (/^\d+$/.test(value)) {
    const milliseconds = Number(value) * 1000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

async function cancelBody(response) {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // Preserve the request error that caused this response to be discarded.
  }
}

export async function fetchBytes(url, {
  allowedOrigin,
  maxBytes,
  timeoutMs,
  maxRedirects = 5,
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError('maxBytes must be a non-negative safe integer');
  }

  const signal = AbortSignal.timeout(timeoutMs);
  let currentUrl = new URL(url);
  let redirectCount = 0;

  while (true) {
    if (currentUrl.origin !== allowedOrigin) {
      throw new Error(`URL is outside the allowed origin: ${currentUrl}`);
    }

    const response = await fetch(currentUrl, { redirect: 'manual', signal });
    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirectCount >= maxRedirects) {
        await cancelBody(response);
        throw new Error(`Request followed more than ${maxRedirects} redirects`);
      }
      const location = response.headers.get('location');
      if (!location) {
        await cancelBody(response);
        throw new Error(`Redirect response has no location: ${currentUrl}`);
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl);
      } finally {
        await cancelBody(response);
      }
      currentUrl = nextUrl;
      redirectCount += 1;
      continue;
    }
    if (!response.ok) {
      const error = new Error(`Request failed: ${response.status}`);
      error.status = response.status;
      const retryAfterMs = retryAfterMilliseconds(response.headers.get('retry-after'));
      if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs;
      await cancelBody(response);
      throw error;
    }

    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
      const declaredBytes = Number(declaredLength);
      if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
        await cancelBody(response);
        throw new Error(`Response exceeds maximum of ${maxBytes} bytes`);
      }
    }

    if (!response.body) return Buffer.alloc(0);
    const chunks = [];
    let receivedBytes = 0;
    for await (const chunk of response.body) {
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maxBytes) {
        throw new Error(`Response exceeds maximum of ${maxBytes} bytes`);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, receivedBytes);
  }
}
