import {describe, expect, it} from 'vitest'
import {didl, findControlUrl} from './dlna-renderer'
import {pickPlayableFile} from './cast'

const DESCRIPTION = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
  <friendlyName>fedivisor(192.168.0.23)</friendlyName>
  <serviceList>
    <service>
      <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
      <controlURL>/RenderingControl/abc/control</controlURL>
    </service>
    <service>
      <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
      <controlURL>/AVTransport/bf3f3ffe-777f-4b77-abb9-e7fc7ff7bfff/control</controlURL>
    </service>
  </serviceList>
</device></root>`

describe('findControlUrl', () => {
  it('picks the AVTransport service, not the first one listed', () => {
    // RenderingControl comes first and only does volume; pushing to it does
    // nothing at all, which is an easy thing to get wrong and hard to notice.
    expect(findControlUrl(DESCRIPTION, 'urn:schemas-upnp-org:service:AVTransport:1')).toBe(
      '/AVTransport/bf3f3ffe-777f-4b77-abb9-e7fc7ff7bfff/control'
    )
  })

  it('returns nothing when the renderer cannot be driven', () => {
    expect(findControlUrl('<root></root>', 'urn:schemas-upnp-org:service:AVTransport:1')).toBeNull()
  })
})

describe('didl', () => {
  const item = {
    url: 'http://192.168.0.16:8765/t/abc/0/a%20film.mkv',
    title: 'a & film.mkv',
    mime: 'video/x-matroska',
    size: 123,
  }

  it('escapes the title so an ampersand cannot break the envelope', () => {
    const xml = didl(item)
    expect(xml).toContain('<dc:title>a &amp; film.mkv</dc:title>')
    expect(xml).not.toContain('<dc:title>a & film')
  })

  it('declares byte-range seeking and the exact size', () => {
    const xml = didl(item)
    expect(xml).toContain('DLNA.ORG_OP=01')
    expect(xml).toContain('size="123"')
    expect(xml).toContain('http-get:*:video/x-matroska:')
  })
})

describe('pickPlayableFile', () => {
  it('takes the feature over the sample shipped next to it', () => {
    const picked = pickPlayableFile([
      {index: 0, name: 'Sample/sample.mkv', size: 50 * 1024 * 1024},
      {index: 1, name: 'The Film.2019.mkv', size: 12 * 1024 * 1024 * 1024},
      {index: 2, name: 'poster.jpg', size: 400 * 1024},
    ])
    expect(picked?.index).toBe(1)
  })

  it('ignores a big non-video file next to a small video one', () => {
    const picked = pickPlayableFile([
      {index: 0, name: 'extras.zip', size: 9e9},
      {index: 1, name: 'clip.mp4', size: 1e6},
    ])
    expect(picked?.index).toBe(1)
  })

  it('falls back to the largest file when nothing looks like video', () => {
    const picked = pickPlayableFile([
      {index: 0, name: 'disc.iso', size: 1e9},
      {index: 1, name: 'readme.txt', size: 10},
    ])
    expect(picked?.index).toBe(0)
  })

  it('has nothing to offer for an empty torrent', () => {
    expect(pickPlayableFile([])).toBeNull()
  })
})
