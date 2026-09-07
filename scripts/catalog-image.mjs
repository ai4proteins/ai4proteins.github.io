const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

export function isGithubPreviewPng(payload) {
  if (!Buffer.isBuffer(payload) || payload.length < PNG_SIGNATURE.length) return false;
  if (!payload.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return false;

  let offset = PNG_SIGNATURE.length;
  let chunkIndex = 0;
  let hasImageData = false;

  while (offset < payload.length) {
    if (payload.length - offset < 12) return false;

    const dataLength = payload.readUInt32BE(offset);
    if (dataLength > payload.length - offset - 12) return false;

    const type = payload.subarray(offset + 4, offset + 8).toString('ascii');
    const dataOffset = offset + 8;
    const nextOffset = offset + 12 + dataLength;

    if (chunkIndex === 0) {
      if (type !== 'IHDR' || dataLength !== 13) return false;
      if (payload.readUInt32BE(dataOffset) !== 1200
        || payload.readUInt32BE(dataOffset + 4) !== 600) return false;
    } else if (type === 'IHDR') {
      return false;
    }

    if (type === 'IDAT' && dataLength > 0) hasImageData = true;
    if (type === 'IEND') {
      return dataLength === 0 && hasImageData && nextOffset === payload.length;
    }

    offset = nextOffset;
    chunkIndex += 1;
  }

  return false;
}
