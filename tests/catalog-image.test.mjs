import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebp } from '../scripts/catalog-image.mjs';

const VALID_WEBP = Buffer.from(
  '524946461c000000574542505650384c0f0000002f000000000710fd8ffe0722a2ff0100',
  'hex',
);

const VALID_LOSSY_WEBP = Buffer.from(
  '524946463c000000574542505650382030000000d001009d012a0100010001402625a00274ba01f80003b000fef2eb7ffcd815cd73eff7ffd2e0fd2e0fd2e0ffd2900000',
  'hex',
);

const VP8X_WITHOUT_IMAGE = Buffer.from(
  '524946461600000057454250565038580a00000000000000000000000000',
  'hex',
);

const ZERO_LENGTH_VP8X_THEN_VALID_VP8L = Buffer.from(
  '52494646240000005745425056503858000000005650384c0f0000002f000000000710fd8ffe0722a2ff0100',
  'hex',
);

function chunk(type, data) {
  const result = Buffer.alloc(8 + data.length + (data.length % 2));
  result.write(type, 0);
  result.writeUInt32LE(data.length, 4);
  data.copy(result, 8);
  return result;
}

function webpContainer(...chunks) {
  const payload = Buffer.concat(chunks);
  const container = Buffer.alloc(12 + payload.length);
  container.write('RIFF', 0);
  container.writeUInt32LE(container.length - 8, 4);
  container.write('WEBP', 8);
  payload.copy(container, 12);
  return container;
}

const VALID_VP8L_CHUNK = VALID_WEBP.subarray(12);
const VALID_VP8X_DATA = Buffer.alloc(10);

test('accepts a decodable literal VP8L WebP fixture', () => {
  assert.equal(isWebp(VALID_WEBP), true);
});

test('accepts a decodable literal VP8 WebP fixture', () => {
  assert.equal(isWebp(VALID_LOSSY_WEBP), true);
});

test('accepts a valid VP8X header followed by one image chunk', () => {
  assert.equal(
    isWebp(webpContainer(chunk('VP8X', VALID_VP8X_DATA), VALID_VP8L_CHUNK)),
    true,
  );
});

test('rejects a zero-length VP8X chunk before a valid image chunk', () => {
  assert.equal(isWebp(ZERO_LENGTH_VP8X_THEN_VALID_VP8L), false);
});

test('rejects invalid VP8X placement, size, and reserved fields', () => {
  const invalidSize = Buffer.alloc(9);
  const reservedFlag = Buffer.from(VALID_VP8X_DATA);
  reservedFlag[0] = 0x80;
  const reservedField = Buffer.from(VALID_VP8X_DATA);
  reservedField[2] = 0x01;

  for (const container of [
    webpContainer(chunk('JUNK', Buffer.alloc(0)), chunk('VP8X', VALID_VP8X_DATA), VALID_VP8L_CHUNK),
    webpContainer(chunk('VP8X', invalidSize), VALID_VP8L_CHUNK),
    webpContainer(chunk('VP8X', reservedFlag), VALID_VP8L_CHUNK),
    webpContainer(chunk('VP8X', reservedField), VALID_VP8L_CHUNK),
  ]) {
    assert.equal(isWebp(container), false);
  }
});

test('rejects duplicate top-level image chunks', () => {
  assert.equal(isWebp(webpContainer(VALID_VP8L_CHUNK, VALID_VP8L_CHUNK)), false);
});

test('rejects payloads without a complete top-level WebP image chunk', () => {
  assert.equal(isWebp(Buffer.alloc(0)), false);
  assert.equal(isWebp(Buffer.from('<!doctype html><html></html>')), false);
  assert.equal(isWebp(Buffer.from('RIFF')), false);
  assert.equal(isWebp(Buffer.from('524946460400000057454250', 'hex')), false);
  assert.equal(isWebp(VP8X_WITHOUT_IMAGE), false);
  assert.equal(isWebp(Buffer.from('524946460700000057454250565038', 'hex')), false);
  assert.equal(isWebp(Buffer.from('5249464610000000574542505650384c050000002f000000', 'hex')), false);

  const inconsistentRiffSize = Buffer.from(VALID_WEBP);
  inconsistentRiffSize.writeUInt32LE(19, 4);
  assert.equal(isWebp(inconsistentRiffSize), false);

  const missingPadding = Buffer.from(VALID_WEBP.subarray(0, -1));
  missingPadding.writeUInt32LE(missingPadding.length - 8, 4);
  assert.equal(isWebp(missingPadding), false);
});

// Keep the container valid so these cases isolate malformed image bitstreams.
function imageContainer(type, hex) {
  const bitstream = Buffer.from(hex, 'hex');
  const container = Buffer.alloc(20 + bitstream.length + bitstream.length % 2);
  container.write('RIFF', 0);
  container.writeUInt32LE(container.length - 8, 4);
  container.write('WEBP', 8);
  container.write(type, 12);
  container.writeUInt32LE(bitstream.length, 16);
  bitstream.copy(container, 20);
  return container;
}

for (const [name, type, hex] of [
  ['empty VP8L chunk', 'VP8L', ''],
  ['empty VP8 chunk', 'VP8 ', ''],
  ['truncated VP8L dimensions', 'VP8L', '2f000000'],
  ['VP8L header without encoded data', 'VP8L', '2f00000000'],
  ['incorrect VP8L signature', 'VP8L', '000000000001'],
  ['truncated VP8 frame header', 'VP8 ', '0000009d012a010001'],
  ['incorrect VP8 key-frame start code', 'VP8 ', '00000000000001000100'],
  ['zero masked VP8 width', 'VP8 ', '0000009d012a00c00100'],
  ['zero masked VP8 height', 'VP8 ', '0000009d012a010000c0'],
  ['VP8 inter-frame instead of key frame', 'VP8 ', '0100009d012a01000100'],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(isWebp(imageContainer(type, hex)), false);
  });
}

test('rejects unsupported VP8L version bits', () => {
  const unsupportedVp8lVersion = Buffer.from(VALID_WEBP);
  unsupportedVp8lVersion[24] |= 0xe0;
  assert.equal(isWebp(unsupportedVp8lVersion), false);
});
