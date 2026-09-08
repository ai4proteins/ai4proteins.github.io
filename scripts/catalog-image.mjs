import { crc32, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const IHDR = Buffer.from('IHDR', 'ascii');
const IDAT = Buffer.from('IDAT', 'ascii');
const IEND = Buffer.from('IEND', 'ascii');

function scanlineBytes(ihdr) {
  if (ihdr[8] !== 8
    || ihdr[9] !== 2
    || ihdr[10] !== 0
    || ihdr[11] !== 0
    || ihdr[12] !== 0) return undefined;

  return 1200 * 3;
}

export function isGithubPreviewPng(payload) {
  if (!Buffer.isBuffer(payload) || payload.length < PNG_SIGNATURE.length) return false;
  if (!payload.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return false;

  let offset = PNG_SIGNATURE.length;
  let hasIdatChunk = false;
  let hasImageData = false;
  let rowBytes;
  const compressedParts = [];

  while (offset < payload.length) {
    if (payload.length - offset < 12) return false;

    const dataLength = payload.readUInt32BE(offset);
    if (dataLength > payload.length - offset - 12) return false;

    const type = payload.subarray(offset + 4, offset + 8);
    const dataOffset = offset + 8;
    const nextOffset = offset + 12 + dataLength;
    const storedCrc = payload.readUInt32BE(dataOffset + dataLength);
    const computedCrc = crc32(payload.subarray(offset + 4, dataOffset + dataLength));
    if (storedCrc !== computedCrc) return false;

    if (offset === PNG_SIGNATURE.length) {
      if (!type.equals(IHDR) || dataLength !== 13) return false;
      if (payload.readUInt32BE(dataOffset) !== 1200
        || payload.readUInt32BE(dataOffset + 4) !== 600) return false;
      rowBytes = scanlineBytes(payload.subarray(dataOffset, dataOffset + dataLength));
      if (rowBytes === undefined) return false;
    } else if (type.equals(IDAT)) {
      hasIdatChunk = true;
      if (dataLength > 0) hasImageData = true;
      compressedParts.push(payload.subarray(dataOffset, dataOffset + dataLength));
    } else if (type.equals(IEND)) {
      if (dataLength !== 0
        || !hasIdatChunk
        || !hasImageData
        || nextOffset !== payload.length) return false;

      const expectedLength = (rowBytes + 1) * 600;
      let scanlines;
      try {
        scanlines = inflateSync(Buffer.concat(compressedParts), {
          maxOutputLength: expectedLength,
        });
      } catch {
        return false;
      }
      if (scanlines.length !== expectedLength) return false;
      for (let row = 0; row < 600; row += 1) {
        if (scanlines[row * (rowBytes + 1)] > 4) return false;
      }
      return true;
    } else {
      return false;
    }

    offset = nextOffset;
  }

  return false;
}
