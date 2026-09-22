import http from 'http'
import {afterEach, describe, expect, it} from 'vitest'
import {DlnaRenderer} from './dlna-renderer'

const CONTROL_PATH = '/AVTransport/bf3f3ffe-777f-4b77-abb9-e7fc7ff7bfff/control'

const DESCRIPTION = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
  <friendlyName>fedivisor</friendlyName>
  <serviceList>
    <service>
      <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
      <controlURL>/RenderingControl/x/control</controlURL>
    </service>
    <service>
      <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
      <controlURL>${CONTROL_PATH}</controlURL>
    </service>
  </serviceList>
</device></root>`

type Received = {path: string; action: string; body: string}

const servers: http.Server[] = []

afterEach(() => {
  servers.splice(0).forEach((server) => server.close())
})

/** Stands in for the television: serves a description and records SOAP calls. */
async function renderer(): Promise<{url: string; calls: Received[]}> {
  const calls: Received[] = []

  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'text/xml'})
      res.end(DESCRIPTION)
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      calls.push({
        path: req.url || '',
        action: String(req.headers.soapaction || ''),
        body: Buffer.concat(chunks).toString(),
      })
      res.writeHead(200, {'Content-Type': 'text/xml'})
      res.end('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"/>')
    })
  })
  servers.push(server)

  server.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (typeof address === 'string' || !address) throw new Error('no port')

  return {url: `http://127.0.0.1:${address.port}/description.xml`, calls}
}

describe('DlnaRenderer', () => {
  const item = {
    url: 'http://192.168.0.16:8765/t/abc/0/The%20Film.mkv',
    title: 'The Film & Friends.mkv',
    mime: 'video/x-matroska',
    size: 28192862052,
  }

  it('sets the URI and then plays, against the AVTransport control URL', async () => {
    const {url, calls} = await renderer()
    await new DlnaRenderer(url).play(item)

    expect(calls).toHaveLength(2)
    expect(calls[0].path).toBe(CONTROL_PATH)
    expect(calls[0].action).toBe('"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"')
    expect(calls[1].action).toBe('"urn:schemas-upnp-org:service:AVTransport:1#Play"')
    expect(calls[1].body).toContain('<Speed>1</Speed>')
  })

  it('sends the stream URL and the metadata a renderer needs to accept it', async () => {
    const {url, calls} = await renderer()
    await new DlnaRenderer(url).play(item)

    const body = calls[0].body
    expect(body).toContain('<CurrentURI>http://192.168.0.16:8765/t/abc/0/The%20Film.mkv</CurrentURI>')
    // DIDL is XML inside an XML element, so it arrives escaped twice over: the
    // ampersand in the title is &amp;amp; by the time it is on the wire.
    expect(body).toContain('&lt;DIDL-Lite')
    expect(body).toContain('The Film &amp;amp; Friends.mkv')
    expect(body).toContain('size=&quot;28192862052&quot;')
    expect(body).toContain('object.item.videoItem')
  })

  it('names the action the renderer refused and forgets the control URL', async () => {
    const {url, calls} = await renderer()
    const server = servers[0]
    server.removeAllListeners('request')

    let descriptions = 0
    // The client retries 5xx, so the fault has to hold across all three
    // attempts — a one-shot fault simply succeeds on the retry.
    let faulting = true
    server.on('request', (req, res) => {
      if (req.method === 'GET') {
        descriptions++
        res.writeHead(200, {'Content-Type': 'text/xml'})
        res.end(DESCRIPTION)
        return
      }
      if (faulting) {
        res.writeHead(500, {'Content-Type': 'text/xml'})
        res.end('<s:Fault><detail><UPnPError><errorCode>716</errorCode></UPnPError></detail></s:Fault>')
        return
      }
      calls.push({path: req.url || '', action: String(req.headers.soapaction || ''), body: ''})
      res.writeHead(200)
      res.end('<ok/>')
    })

    await expect(new DlnaRenderer(url).play(item)).rejects.toThrow(/SetAVTransportURI refused.*716/s)
    faulting = false

    // A renderer that has moved is the usual cause, so the cached control URL
    // is dropped and the description read again rather than retried blindly.
    const second = new DlnaRenderer(url)
    await second.play(item)
    expect(descriptions).toBeGreaterThanOrEqual(2)
  }, 20000)
})
