import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebp } from '../scripts/catalog-image.mjs';

function webpBuffer() {
  const image = Buffer.alloc(12);
  image.write('RIFF');
  image.writeUInt32LE(4, 4);
  image.write('WEBP', 8);
  return image;
}

test('rejects empty, HTML, truncated, and malformed WebP payloads', () => {
  assert.equal(isWebp(Buffer.alloc(0)), false);
  assert.equal(isWebp(Buffer.from('<!doctype html><html></html>')), false);
  assert.equal(isWebp(Buffer.from('RIFF')), false);

  const malformed = webpBuffer();
  malformed.writeUInt32LE(5, 4);
  assert.equal(isWebp(malformed), false);

  assert.equal(isWebp(webpBuffer()), true);
});
