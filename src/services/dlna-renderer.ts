import {createHttpClient} from '../http'

const AVTRANSPORT = 'urn:schemas-upnp-org:service:AVTransport:1'

/**
 * Byte-range seeking is supported (`OP=01`) and nothing was transcoded
 * (`CI=0`) — the renderer is being handed the torrent's own file.
 */
const DLNA_FEATURES = 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'

export type Playable = {
  url: string
  title: string
  mime: string
  size: number
}

/**
 * Pushes a URL at a UPnP renderer and tells it to play. The renderer then pulls
 * the bytes itself, which is what keeps the worker out of the media path.
 *
 * The renderer's address is configured rather than discovered: SSDP is
 * multicast and would not leave a bridged container.
 */
export class DlnaRenderer {
  private readonly client = createHttpClient('')
  private controlUrl = ''

  constructor(private readonly descriptionUrl: string) {}

  async play(item: Playable): Promise<void> {
    const control = await this.control()
    await this.soap(control, 'SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: escapeXml(item.url),
      CurrentURIMetaData: escapeXml(didl(item)),
    })
    await this.soap(control, 'Play', {InstanceID: 0, Speed: 1})
  }

  async stop(): Promise<void> {
    await this.soap(await this.control(), 'Stop', {InstanceID: 0})
  }

  /** Cached, but re-read if a call fails — the port often moves across reboots. */
  private async control(): Promise<string> {
    if (this.controlUrl) return this.controlUrl

    const {data} = await this.client.get<string>(this.descriptionUrl, {responseType: 'text'})
    const relative = findControlUrl(String(data), AVTRANSPORT)
    if (!relative) throw new Error(`No AVTransport service at ${this.descriptionUrl}`)

    this.controlUrl = new URL(relative, this.descriptionUrl).toString()
    return this.controlUrl
  }

  private async soap(control: string, action: string, args: Record<string, string | number>): Promise<string> {
    const body = Object.keys(args)
      .map((key) => `<${key}>${args[key]}</${key}>`)
      .join('')

    const envelope =
      '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
      's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' +
      `<u:${action} xmlns:u="${AVTRANSPORT}">${body}</u:${action}>` +
      '</s:Body></s:Envelope>'

    try {
      const {data} = await this.client.post<string>(control, envelope, {
        headers: {'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: `"${AVTRANSPORT}#${action}"`},
      })
      return String(data)
    } catch (error: any) {
      // A stale control URL is the usual cause, so the next call re-reads it.
      this.controlUrl = ''
      const detail = error.response?.data ? String(error.response.data).slice(0, 300) : error?.message
      throw new Error(`${action} refused by renderer: ${detail}`)
    }
  }
}

/**
 * Renderers that accept SetAVTransportURI and then do nothing are usually
 * objecting to missing metadata rather than to the URL, so this is not optional.
 */
export function didl(item: Playable): string {
  return (
    '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">' +
    '<item id="1" parentID="0" restricted="1">' +
    `<dc:title>${escapeXml(item.title)}</dc:title>` +
    '<upnp:class>object.item.videoItem</upnp:class>' +
    `<res protocolInfo="http-get:*:${item.mime}:${DLNA_FEATURES}" size="${item.size}">` +
    `${escapeXml(item.url)}</res>` +
    '</item></DIDL-Lite>'
  )
}

export function findControlUrl(xml: string, serviceType: string): string | null {
  const services = xml.match(/<service>[\s\S]*?<\/service>/g) || []

  for (const service of services) {
    if (service.indexOf(serviceType) < 0) continue
    const match = /<controlURL>([^<]*)<\/controlURL>/.exec(service)
    if (match) return match[1].trim()
  }
  return null
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
