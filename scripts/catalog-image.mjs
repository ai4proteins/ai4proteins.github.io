const RIFF_HEADER = 'RIFF';
const WEBP_HEADER = 'WEBP';
const IMAGE_CHUNK_TYPES = new Set(['VP8 ', 'VP8L']);

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
    if (IMAGE_CHUNK_TYPES.has(chunkType)) hasImagePayload = true;

    offset = chunkStart + paddedChunkSize;
  }

  return offset === payload.length && hasImagePayload;
}
