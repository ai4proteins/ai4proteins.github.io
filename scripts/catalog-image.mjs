const RIFF_HEADER = 'RIFF';
const WEBP_HEADER = 'WEBP';

export function isWebp(payload) {
  return Buffer.isBuffer(payload)
    && payload.length >= 12
    && payload.subarray(0, 4).toString() === RIFF_HEADER
    && payload.subarray(8, 12).toString() === WEBP_HEADER
    && payload.readUInt32LE(4) + 8 === payload.length;
}
