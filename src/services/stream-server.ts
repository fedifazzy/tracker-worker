import fs from 'fs'
import http from 'http'
import path from 'path'
import {FileLocation, PieceSource, availableFrom} from './piece-map'
import {pieceSource} from './torrent-client'

const CHUNK_BYTES = 256 * 1024
const POLL_INTERVAL_MS = 500

/**
 * How long to wait on one blocked position before giving up. A swarm that has
 * gone quiet would otherwise hold the connection open forever, and the player
 * shows a spinner rather than an error.
 */
const STALL_TIMEOUT_MS = 120_000

/**
 * Announces byte-range seeking (`OP=01`) and that nothing was transcoded
 * (`CI=0`). Harmless for players that ignore it, required by DLNA renderers.
 */
const DLNA_FEATURES = 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'

const CONTENT_TYPES: Record<string, string> = {
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
}

type Range = {start: number; end: number}

/** Set when the client hangs up, which it does on every seek. */
type Cancelled = {value: boolean}

export class StreamServer {
  private server?: http.Server

  constructor(private readonly source: PieceSource) {}

  listen(port: number): http.Server {
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((error) => {
        console.error(`stream: ${error?.message || error}`)
        if (!res.headersSent) res.writeHead(500)
        res.end()
      })
    })
    this.server.listen(port, () => {
      const address = this.server?.address()
      console.log(`Stream server on :${typeof address === 'object' && address ? address.port : port}`)
    })
    return this.server
  }

  close(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()))
  }

  /** The path a player should be pointed at. Host is the caller's business. */
  pathFor(hash: string, fileIndex: number, filename?: string): string {
    const tail = filename ? `/${encodeURIComponent(filename)}` : ''
    return `/t/${hash}/${fileIndex}${tail}`
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {Allow: 'GET, HEAD'})
      res.end()
      return
    }

    const target = parseTarget(req.url || '')
    if (!target) {
      res.writeHead(404)
      res.end()
      return
    }

    const loc = await this.source.locate(target.hash, target.fileIndex)
    const range = parseRange(req.headers.range, loc.length)

    if (range === 'unsatisfiable') {
      res.writeHead(416, {'Content-Range': `bytes */${loc.length}`})
      res.end()
      return
    }

    const {start, end} = range ?? {start: 0, end: loc.length - 1}
    this.writeHead(res, loc, start, end, range !== null)

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    const cancelled: Cancelled = {value: false}
    res.on('close', () => (cancelled.value = true))

    await this.pump(res, target.hash, loc, start, end, cancelled)
    if (!cancelled.value) res.end()
  }

  /**
   * The exact final size is in the torrent's metadata from the moment it is
   * added, long before the bytes arrive. That is what lets a player treat a
   * download in progress as an ordinary file it can seek around in.
   */
  private writeHead(res: http.ServerResponse, loc: FileLocation, start: number, end: number, partial: boolean): void {
    const headers: Record<string, string> = {
      'Content-Type': contentTypeFor(loc.path),
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'transferMode.dlna.org': 'Streaming',
      'contentFeatures.dlna.org': DLNA_FEATURES,
    }
    if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${loc.length}`
    res.writeHead(partial ? 206 : 200, headers)
  }

  private async pump(
    res: http.ServerResponse,
    hash: string,
    loc: FileLocation,
    start: number,
    end: number,
    cancelled: Cancelled
  ): Promise<void> {
    const handle = await fs.promises.open(loc.path, 'r')
    const buffer = Buffer.allocUnsafe(CHUNK_BYTES)
    let position = start

    try {
      while (position <= end && !cancelled.value) {
        const ready = await this.waitFor(hash, loc, position, cancelled)
        if (ready === 0) {
          // Either the client left or the swarm stalled. Destroying the socket
          // is the only honest signal left: the headers promised more bytes.
          res.destroy()
          return
        }

        const until = Math.min(end, position + ready - 1)
        while (position <= until && !cancelled.value) {
          const want = Math.min(CHUNK_BYTES, until - position + 1)
          const {bytesRead} = await handle.read(buffer, 0, want, position)
          if (bytesRead === 0) {
            // The bitmap said these bytes exist. They do not, so the mapping
            // between the torrent and this file is wrong, not the swarm.
            console.error(`stream: short read at ${position} of ${loc.path}`)
            res.destroy()
            return
          }
          position += bytesRead
          if (!res.write(buffer.subarray(0, bytesRead))) await drain(res)
        }
      }
    } finally {
      await handle.close()
    }
  }

  /** Blocks until at least one byte at `from` is readable, or gives up. */
  private async waitFor(hash: string, loc: FileLocation, from: number, cancelled: Cancelled): Promise<number> {
    const deadline = Date.now() + STALL_TIMEOUT_MS

    while (!cancelled.value) {
      const pieces = await this.source.pieces(hash)
      const ready = availableFrom(loc, pieces, from)
      if (ready > 0) return ready

      if (Date.now() >= deadline) {
        console.error(`stream: stalled at byte ${from} of ${loc.path}`)
        return 0
      }
      await sleep(POLL_INTERVAL_MS)
    }
    return 0
  }
}

function parseTarget(url: string): {hash: string; fileIndex: number} | null {
  // /t/<hash>/<index> with an optional trailing name, which some players use
  // to guess the container from the extension.
  const match = /^\/t\/([0-9a-fA-F]{40})\/(\d+)(?:\/|$)/.exec(url.split('?')[0])
  if (!match) return null
  return {hash: match[1].toLowerCase(), fileIndex: Number(match[2])}
}

export function parseRange(header: string | undefined, size: number): Range | null | 'unsatisfiable' {
  if (!header) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  // `bytes=-500` asks for the last 500 bytes, which is how players find an
  // index parked at the end of the file.
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (suffix === 0) return 'unsatisfiable'
    return {start: Math.max(0, size - suffix), end: size - 1}
  }

  const start = Number(rawStart)
  if (start >= size) return 'unsatisfiable'

  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (end < start) return 'unsatisfiable'

  return {start, end}
}

function contentTypeFor(filePath: string): string {
  const name = filePath.replace(/\.part$/, '')
  return CONTENT_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream'
}

function drain(res: http.ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      res.off('drain', done)
      res.off('close', done)
      resolve()
    }
    res.once('drain', done)
    res.once('close', done)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const streamServer = new StreamServer(pieceSource)
