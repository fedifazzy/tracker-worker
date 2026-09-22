import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import {afterEach, describe, expect, it} from 'vitest'
import {FileLocation, PieceSource, availableFrom, parseBitfield} from './piece-map'
import {StreamServer, parseRange} from './stream-server'

const PIECE = 1024
const PIECES = 4
const SIZE = PIECE * PIECES

/** Byte value written into piece `n`, so a wrong offset is visible in the body. */
const fill = (n: number) => Buffer.alloc(PIECE, 0xa0 + n)

class FakeSource implements PieceSource {
  constructor(
    private readonly loc: FileLocation,
    public have: boolean[]
  ) {}

  async locate(): Promise<FileLocation> {
    return this.loc
  }

  async pieces(): Promise<boolean[]> {
    return this.have
  }
}

const HASH = 'a'.repeat(40)
const servers: StreamServer[] = []
const files: string[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
  files.splice(0).forEach((f) => fs.rmSync(f, {force: true}))
})

/**
 * Writes the file the way a torrent client leaves it: pieces that have landed
 * hold their data, the rest read back as zeros rather than as end-of-file.
 */
function makeFile(landed: number): string {
  const file = path.join(os.tmpdir(), `stream-test-${Math.random().toString(36).slice(2)}.mkv`)
  const buffers = []
  for (let i = 0; i < PIECES; i++) buffers.push(i < landed ? fill(i) : Buffer.alloc(PIECE))
  fs.writeFileSync(file, Buffer.concat(buffers))
  files.push(file)
  return file
}

async function serve(landed: number): Promise<{port: number; source: FakeSource; file: string}> {
  const file = makeFile(landed)
  const loc: FileLocation = {offset: 0, length: SIZE, pieceLength: PIECE, path: file}
  const have = new Array(PIECES).fill(false).map((_, i) => i < landed)
  const source = new FakeSource(loc, have)
  const server = new StreamServer(source)
  servers.push(server)

  const listening = server.listen(0)
  await new Promise((resolve) => listening.once('listening', resolve))
  const address = listening.address()
  if (typeof address === 'string' || !address) throw new Error('no port')
  return {port: address.port, source, file}
}

function get(port: number, headers: Record<string, string> = {}) {
  return new Promise<{status: number; headers: http.IncomingHttpHeaders; body: Buffer}>((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, path: `/t/${HASH}/0`, headers}, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks)}))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('availableFrom', () => {
  const loc: FileLocation = {offset: 0, length: SIZE, pieceLength: PIECE, path: ''}

  it('reports nothing when the piece under the cursor is missing', () => {
    expect(availableFrom(loc, [false, true, true, true], 0)).toBe(0)
  })

  it('runs to the end of the last contiguous piece', () => {
    expect(availableFrom(loc, [true, true, false, true], 0)).toBe(2 * PIECE)
    expect(availableFrom(loc, [true, true, false, true], 512)).toBe(2 * PIECE - 512)
  })

  it('never reports past the end of the file, whatever the next file holds', () => {
    const tail: FileLocation = {offset: 0, length: PIECE + 100, pieceLength: PIECE, path: ''}
    expect(availableFrom(tail, [true, true, true, true], 0)).toBe(PIECE + 100)
  })

  it('counts pieces from the file offset, not from the file start', () => {
    // The file begins halfway through piece 0, so its byte 0 needs piece 0 and
    // its byte 512 needs piece 1.
    const mid: FileLocation = {offset: 512, length: 2048, pieceLength: PIECE, path: ''}
    expect(availableFrom(mid, [false, true, true], 0)).toBe(0)
    expect(availableFrom(mid, [true, false, true], 0)).toBe(512)
    expect(availableFrom(mid, [false, true, true], 512)).toBe(1536)
  })
})

describe('parseBitfield', () => {
  it('reads the most significant bit of each byte first', () => {
    const bytes = Buffer.from([0b10100000, 0b01000000]).toString('base64')
    expect(parseBitfield(bytes, 10)).toEqual([true, false, true, false, false, false, false, false, false, true])
  })
})

describe('parseRange', () => {
  it('handles the forms players actually send', () => {
    expect(parseRange(undefined, SIZE)).toBeNull()
    expect(parseRange('bytes=0-', SIZE)).toEqual({start: 0, end: SIZE - 1})
    expect(parseRange('bytes=100-199', SIZE)).toEqual({start: 100, end: 199})
    expect(parseRange('bytes=0-99999', SIZE)).toEqual({start: 0, end: SIZE - 1})
  })

  it('resolves a suffix range against the known final size', () => {
    // How a player reaches an index parked at the end of a file it has not
    // finished downloading.
    expect(parseRange('bytes=-300', SIZE)).toEqual({start: SIZE - 300, end: SIZE - 1})
  })

  it('rejects a start past the end', () => {
    expect(parseRange(`bytes=${SIZE}-`, SIZE)).toBe('unsatisfiable')
  })
})

describe('StreamServer', () => {
  it('advertises the final size before the bytes exist', async () => {
    const {port} = await serve(1)
    const res = await get(port, {Range: 'bytes=0-1023'})

    expect(res.status).toBe(206)
    expect(res.headers['content-range']).toBe(`bytes 0-1023/${SIZE}`)
    expect(res.headers['content-length']).toBe('1024')
    expect(res.headers['accept-ranges']).toBe('bytes')
    expect(res.headers['content-type']).toBe('video/x-matroska')
    expect(res.body.equals(fill(0))).toBe(true)
  })

  it('serves the tail once it lands, which is where the index lives', async () => {
    const {port} = await serve(PIECES)
    const res = await get(port, {Range: 'bytes=-1024'})

    expect(res.status).toBe(206)
    expect(res.body.equals(fill(3))).toBe(true)
  })

  it('waits for a missing piece instead of serving the hole as zeros', async () => {
    const {port, source, file} = await serve(2)
    const started = Date.now()

    setTimeout(() => {
      // The piece lands: the client writes the real bytes, then marks it valid.
      const handle = fs.openSync(file, 'r+')
      fs.writeSync(handle, fill(2), 0, PIECE, 2 * PIECE)
      fs.closeSync(handle)
      source.have[2] = true
    }, 300)

    const res = await get(port, {Range: 'bytes=2048-3071'})

    expect(Date.now() - started).toBeGreaterThanOrEqual(250)
    expect(res.status).toBe(206)
    expect(res.body.equals(fill(2))).toBe(true)
    expect(res.body.equals(Buffer.alloc(PIECE))).toBe(false)
  })

  it('answers an unsatisfiable range without opening the file', async () => {
    const {port} = await serve(PIECES)
    const res = await get(port, {Range: `bytes=${SIZE + 10}-`})

    expect(res.status).toBe(416)
    expect(res.headers['content-range']).toBe(`bytes */${SIZE}`)
  })
})
