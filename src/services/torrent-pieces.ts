import fs from 'fs'
import path from 'path'
import {FileLocation, PieceSource, parseBitfield} from './piece-map'
import {transmissionRpc} from './transmission-rpc'

/** Transmission renames files it has not finished yet (`rename-partial-files`). */
const PARTIAL_SUFFIX = '.part'

/**
 * Concurrent readers of the same torrent poll constantly, and the bitmap only
 * changes as fast as pieces land. One RPC round trip per window is plenty.
 */
const BITMAP_TTL_MS = 500

type CachedBitmap = {
  pieces: boolean[]
  at: number
}

export class TorrentPieces implements PieceSource {
  private readonly bitmaps = new Map<string, CachedBitmap>()
  private readonly inFlight = new Map<string, Promise<boolean[]>>()

  /**
   * Where a file sits inside the torrent. The offset is the sum of the lengths
   * of every file before it, because that is the order Transmission lays the
   * torrent's piece space out in.
   */
  async locate(hash: string, fileIndex: number): Promise<FileLocation> {
    const res = await transmissionRpc.request('torrent-get', {
      ids: [hash],
      fields: ['files', 'pieceSize', 'downloadDir'],
    })
    const torrent = res.arguments?.torrents?.[0]
    if (!torrent) throw new Error(`No such torrent: ${hash}`)

    const files: Array<{name: string; length: number}> = torrent.files ?? []
    const file = files[fileIndex]
    if (!file) throw new Error(`Torrent ${hash} has no file at index ${fileIndex}`)

    let offset = 0
    for (let i = 0; i < fileIndex; i++) offset += files[i].length

    return {
      offset,
      length: file.length,
      pieceLength: torrent.pieceSize,
      path: resolveOnDisk(torrent.downloadDir, file.name),
    }
  }

  /** One entry per piece of the whole torrent, true once it is verified. */
  async pieces(hash: string): Promise<boolean[]> {
    const cached = this.bitmaps.get(hash)
    if (cached && Date.now() - cached.at < BITMAP_TTL_MS) return cached.pieces

    const pending = this.inFlight.get(hash)
    if (pending) return pending

    const request = this.fetchPieces(hash).finally(() => this.inFlight.delete(hash))
    this.inFlight.set(hash, request)
    return request
  }

  private async fetchPieces(hash: string): Promise<boolean[]> {
    const res = await transmissionRpc.request('torrent-get', {
      ids: [hash],
      fields: ['pieces', 'pieceCount'],
    })
    const torrent = res.arguments?.torrents?.[0]
    if (!torrent) throw new Error(`No such torrent: ${hash}`)

    const pieces = parseBitfield(torrent.pieces, torrent.pieceCount)
    this.bitmaps.set(hash, {pieces, at: Date.now()})
    return pieces
  }
}

/**
 * Transmission reports the name a file will have when it is finished, so a
 * download still in progress lives under the partial suffix instead.
 */
function resolveOnDisk(downloadDir: string, name: string): string {
  const finished = path.join(downloadDir, name)
  if (fs.existsSync(finished)) return finished

  const partial = finished + PARTIAL_SUFFIX
  if (fs.existsSync(partial)) return partial

  return finished
}

export const transmissionPieces = new TorrentPieces()
