import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebp } from '../scripts/catalog-image.mjs';

const VALID_VP8L = Buffer.from(
  '5249464612000000574542505650384c050000002f0000000000',
  'hex',
);

const VP8X_WITHOUT_IMAGE = Buffer.from(
  '524946461600000057454250565038580a00000000000000000000000000',
  'hex',
);

test('rejects payloads without a complete top-level WebP image chunk', () => {
  assert.equal(isWebp(Buffer.alloc(0)), false);
  assert.equal(isWebp(Buffer.from('<!doctype html><html></html>')), false);
  assert.equal(isWebp(Buffer.from('RIFF')), false);
  assert.equal(isWebp(Buffer.from('524946460400000057454250', 'hex')), false);
  assert.equal(isWebp(VP8X_WITHOUT_IMAGE), false);
  assert.equal(isWebp(Buffer.from('524946460700000057454250565038', 'hex')), false);
  assert.equal(isWebp(Buffer.from('5249464610000000574542505650384c050000002f000000', 'hex')), false);

  const inconsistentRiffSize = Buffer.from(VALID_VP8L);
  inconsistentRiffSize.writeUInt32LE(19, 4);
  assert.equal(isWebp(inconsistentRiffSize), false);

  assert.equal(isWebp(VALID_VP8L), true);
});
