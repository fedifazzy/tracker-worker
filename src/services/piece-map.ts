/**
 * Byte availability inside a torrent that is still downloading.
 *
 * Transmission preallocates sparse files (`"preallocation": 1`), so reading past
 * the download head returns *zeros*, not EOF. A player fed those zeros does not
 * wait — it decodes garbage or dies. Every read therefore has to be checked
 * against the piece bitmap first, which is what this module is for.
 */

export type FileLocation = {
  /** Where this file starts in the torrent's piece space, in bytes. */
  offset: number
  length: number
  pieceLength: number
  /** Path on disk, including the incomplete-file suffix if there is one. */
  path: string
}

/**
 * Decodes Transmission's `pieces` field: base64, one bit per piece, most
 * significant bit of each byte first.
 */
export function parseBitfield(base64: string, pieceCount: number): boolean[] {
  const bytes = Buffer.from(base64, 'base64')
  const pieces: boolean[] = new Array(pieceCount)
  for (let i = 0; i < pieceCount; i++) {
    const byte = bytes[i >> 3] || 0
    pieces[i] = (byte & (0x80 >> (i & 7))) !== 0
  }
  return pieces
}

/**
 * How many bytes are readable right now starting at `from`, which is relative to
 * the file rather than the torrent. Zero means the very next byte is missing.
 * Never reports past the end of the file, even when later pieces are complete —
 * those bytes belong to the next file in the torrent.
 */
export function availableFrom(loc: FileLocation, pieces: boolean[], from: number): number {
  if (from < 0 || from >= loc.length) return 0

  const absolute = loc.offset + from
  let piece = Math.floor(absolute / loc.pieceLength)
  if (!pieces[piece]) return 0

  while (pieces[piece + 1]) piece++

  const readableTo = (piece + 1) * loc.pieceLength - 1
  return Math.min(readableTo - absolute + 1, loc.length - from)
}

/**
 * What the HTTP layer needs from a torrent engine. Transmission satisfies this
 * today; swapping in qBittorrent means writing one more implementation and
 * touching nothing else.
 */
export interface PieceSource {
  locate(hash: string, fileIndex: number): Promise<FileLocation>
  /** One entry per piece of the whole torrent, true once it is verified. */
  pieces(hash: string): Promise<boolean[]>
}

/** The piece holding the byte at `from`, for asking the engine to hurry up. */
export function pieceAt(loc: FileLocation, from: number): number {
  return Math.floor((loc.offset + from) / loc.pieceLength)
}
