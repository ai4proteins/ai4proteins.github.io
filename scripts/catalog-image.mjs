const RIFF_HEADER = 'RIFF';
const WEBP_HEADER = 'WEBP';

export function isWebp(payload) {
  if (!Buffer.isBuffer(payload) || payload.length < 12) return false;
  if (payload.subarray(0, 4).toString() !== RIFF_HEADER) return false;
  if (payload.subarray(8, 12).toString() !== WEBP_HEADER) return false;
  if (payload.readUInt32LE(4) + 8 !== payload.length) return false;

  let offset = 12;
  let hasImagePayload = false;

  while (offset < payload.length) {
    if (payload.length - offset < 8) return false;

    const chunkType = payload.subarray(offset, offset + 4).toString();
    const chunkSize = payload.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const paddedChunkSize = chunkSize + (chunkSize % 2);

    if (paddedChunkSize > payload.length - chunkStart) return false;
    if (chunkType === 'VP8 ') {
      if (chunkSize < 10 || (payload[chunkStart] & 1) !== 0) return false;
      if (payload[chunkStart + 3] !== 0x9d
        || payload[chunkStart + 4] !== 0x01
        || payload[chunkStart + 5] !== 0x2a) return false;
      if ((payload.readUInt16LE(chunkStart + 6) & 0x3fff) === 0
        || (payload.readUInt16LE(chunkStart + 8) & 0x3fff) === 0) return false;
      hasImagePayload = true;
    } else if (chunkType === 'VP8L') {
      // Five header bytes must be followed by encoded image data.
      if (chunkSize <= 5 || payload[chunkStart] !== 0x2f) return false;
      if ((payload[chunkStart + 4] & 0xe0) !== 0) return false;
      hasImagePayload = true;
    }

    offset = chunkStart + paddedChunkSize;
  }

  return offset === payload.length && hasImagePayload;
}
