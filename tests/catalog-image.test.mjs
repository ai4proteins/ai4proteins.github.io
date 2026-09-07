import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import { isGithubPreviewPng } from '../scripts/catalog-image.mjs';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const WIDTH = 1200;
const HEIGHT = 600;
const RGB_ROW_BYTES = WIDTH * 3;

function pngChunk(type, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function ihdr(width = 1200, height = 600) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 2;
  return pngChunk('IHDR', data);
}

function png(...chunks) {
  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

function rgbScanlines() {
  return Buffer.alloc((RGB_ROW_BYTES + 1) * HEIGHT);
}

const COMPRESSED_SCANLINES = deflateSync(rgbScanlines());
const VALID_PNG = png(
  ihdr(),
  pngChunk('IDAT', COMPRESSED_SCANLINES),
  pngChunk('IEND'),
);

test('accepts a decodable 1200x600 PNG with valid CRCs and scanlines', () => {
  assert.equal(isGithubPreviewPng(VALID_PNG), true);
});

test('rejects CRC corruption', () => {
  const corruptIendCrc = Buffer.from(VALID_PNG);
  corruptIendCrc[corruptIendCrc.length - 1] ^= 0xff;
  assert.equal(isGithubPreviewPng(corruptIendCrc), false);
});

test('rejects invalid or truncated IDAT deflate data', () => {
  assert.equal(
    isGithubPreviewPng(png(ihdr(), pngChunk('IDAT', Buffer.from([1, 2, 3])), pngChunk('IEND'))),
    false,
  );
  assert.equal(
    isGithubPreviewPng(png(
      ihdr(),
      pngChunk('IDAT', COMPRESSED_SCANLINES.subarray(0, -2)),
      pngChunk('IEND'),
    )),
    false,
  );
});

test('rejects decompressed scanlines with the wrong total length', () => {
  const shortScanlines = rgbScanlines().subarray(0, -1);
  assert.equal(
    isGithubPreviewPng(png(ihdr(), pngChunk('IDAT', deflateSync(shortScanlines)), pngChunk('IEND'))),
    false,
  );
});

test('rejects scanlines with invalid filter bytes', () => {
  const scanlines = rgbScanlines();
  scanlines[0] = 5;
  assert.equal(
    isGithubPreviewPng(png(ihdr(), pngChunk('IDAT', deflateSync(scanlines)), pngChunk('IEND'))),
    false,
  );
});

test('rejects non-buffer data and a wrong PNG signature', () => {
  assert.equal(isGithubPreviewPng('not bytes'), false);
  assert.equal(isGithubPreviewPng(Buffer.alloc(0)), false);

  const wrongSignature = Buffer.from(VALID_PNG);
  wrongSignature[0] = 0;
  assert.equal(isGithubPreviewPng(wrongSignature), false);
});

test('rejects truncated chunk headers and chunk payloads', () => {
  assert.equal(isGithubPreviewPng(VALID_PNG.subarray(0, 11)), false);

  const truncatedIdat = png(ihdr(), pngChunk('IDAT', COMPRESSED_SCANLINES).subarray(0, -2));
  assert.equal(isGithubPreviewPng(truncatedIdat), false);

  const oversizedChunk = Buffer.from(VALID_PNG);
  oversizedChunk.writeUInt32BE(0xffff_ffff, 8);
  assert.equal(isGithubPreviewPng(oversizedChunk), false);
});

test('rejects PNGs without image data or an end chunk', () => {
  assert.equal(isGithubPreviewPng(png(ihdr(), pngChunk('IEND'))), false);
  assert.equal(isGithubPreviewPng(png(ihdr(), pngChunk('IDAT', COMPRESSED_SCANLINES))), false);
  assert.equal(isGithubPreviewPng(png(ihdr(), pngChunk('IDAT'), pngChunk('IEND'))), false);
});

test('rejects PNGs whose IHDR dimensions are not exactly 1200x600', () => {
  assert.equal(
    isGithubPreviewPng(png(ihdr(1199, 600), pngChunk('IDAT', COMPRESSED_SCANLINES), pngChunk('IEND'))),
    false,
  );
  assert.equal(
    isGithubPreviewPng(png(ihdr(1200, 601), pngChunk('IDAT', COMPRESSED_SCANLINES), pngChunk('IEND'))),
    false,
  );
});

test('rejects bytes after IEND', () => {
  assert.equal(isGithubPreviewPng(Buffer.concat([VALID_PNG, Buffer.from([0])])), false);
});

test('requires a single first IHDR and a zero-length IEND', () => {
  assert.equal(
    isGithubPreviewPng(png(pngChunk('IDAT', COMPRESSED_SCANLINES), ihdr(), pngChunk('IEND'))),
    false,
  );
  assert.equal(
    isGithubPreviewPng(png(ihdr(), ihdr(), pngChunk('IDAT', COMPRESSED_SCANLINES), pngChunk('IEND'))),
    false,
  );
  assert.equal(
    isGithubPreviewPng(png(ihdr(), pngChunk('IDAT', COMPRESSED_SCANLINES), pngChunk('IEND', Buffer.from([0])))),
    false,
  );
});
