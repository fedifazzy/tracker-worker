import {describe, expect, it} from 'vitest'
import {infoHashFromMagnet} from './qbittorrent-api'

describe('infoHashFromMagnet', () => {
  const hex = '0123456789abcdef0123456789abcdef01234567'

  it('takes a hex infohash as it is, lowercased', () => {
    expect(infoHashFromMagnet(`magnet:?xt=urn:btih:${hex.toUpperCase()}&dn=x`)).toBe(hex)
  })

  it('converts the base32 spelling older trackers still hand out', () => {
    // The same 20 bytes, base32 encoded — what rutracker's magnets used to look
    // like. qBittorrent reports hashes in hex, so this has to match.
    const bytes = Buffer.from(hex, 'hex')
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = ''
    for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
    let base32 = ''
    for (let i = 0; i < bits.length; i += 5) base32 += alphabet[parseInt(bits.slice(i, i + 5), 2)]

    expect(base32).toHaveLength(32)
    expect(infoHashFromMagnet(`magnet:?xt=urn:btih:${base32}`)).toBe(hex)
  })

  it('refuses a magnet it cannot identify rather than adding the wrong torrent', () => {
    expect(() => infoHashFromMagnet('magnet:?dn=no-hash-here')).toThrow(/infohash/)
    expect(() => infoHashFromMagnet('magnet:?xt=urn:btih:tooshort')).toThrow(/Unrecognised/)
  })
})
