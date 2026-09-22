import path from 'path'
import {FileLocation, PieceSource} from './piece-map'
import {qbittorrentApi} from './qbittorrent-api'
import {qbittorrent} from './qbittorrent-service'

/** qBittorrent's own numbering: 0 missing, 1 being fetched, 2 downloaded. */
const PIECE_DOWNLOADED = 2

const BITMAP_TTL_MS = 500

type Properties = {
  piece_size: number
  save_path: string
}

type CachedBitmap = {
  pieces: boolean[]
  at: number
}

export class QBittorrentPieces implements PieceSource {
  private readonly bitmaps = new Map<string, CachedBitmap>()
  private readonly inFlight = new Map<string, Promise<boolean[]>>()

  async locate(hash: string, fileIndex: number): Promise<FileLocation> {
    const [properties, files] = await Promise.all([
      qbittorrentApi.get<Properties>('/torrents/properties', {hash}),
      qbittorrent.files(hash),
    ])

    const file = files[fileIndex]
    if (!file) throw new Error(`Torrent ${hash} has no file at index ${fileIndex}`)

    let offset = 0
    for (let i = 0; i < fileIndex; i++) offset += files[i].size

    return {
      offset,
      length: file.size,
      pieceLength: properties.piece_size,
      path: path.join(properties.save_path, file.name),
    }
  }

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
    const states = await qbittorrentApi.get<number[]>('/torrents/pieceStates', {hash})
    if (!Array.isArray(states)) throw new Error(`No piece states for ${hash}`)

    const pieces = states.map((state) => state === PIECE_DOWNLOADED)
    this.bitmaps.set(hash, {pieces, at: Date.now()})
    return pieces
  }
}

export const qbittorrentPieces = new QBittorrentPieces()
