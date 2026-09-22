import {AxiosInstance} from 'axios'
import {createHttpClient} from '../http'
import {appConfig} from '../config'

/**
 * qBittorrent's WebUI API v2. The config ships with `WebUI\LocalHostAuth=false`
 * so a request from inside this container needs no session, but a login is kept
 * as a fallback for anyone who turns that back on.
 */
export class QBittorrentApi {
  private readonly client: AxiosInstance
  private cookie = ''

  constructor(baseUrl: string) {
    this.client = createHttpClient(baseUrl)
  }

  async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    return this.send<T>(() => this.client.get<T>(endpoint, {params, headers: this.headers()}))
  }

  async post<T = string>(endpoint: string, form: Record<string, any> = {}): Promise<T> {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(form)) {
      if (value !== undefined && value !== null) body.append(key, String(value))
    }
    return this.send<T>(() =>
      this.client.post<T>(endpoint, body.toString(), {
        headers: {...this.headers(), 'Content-Type': 'application/x-www-form-urlencoded'},
      })
    )
  }

  private headers(): Record<string, string> {
    return this.cookie ? {Cookie: this.cookie} : {}
  }

  private async send<T>(request: () => Promise<{data: T}>): Promise<T> {
    try {
      const {data} = await request()
      return data
    } catch (error: any) {
      if (error.response?.status !== 403) throw error
      await this.login()
      const {data} = await request()
      return data
    }
  }

  private async login(): Promise<void> {
    const body = new URLSearchParams({
      username: appConfig.QBT_USERNAME || 'admin',
      password: appConfig.QBT_PASSWORD || 'adminadmin',
    })
    const response = await this.client.post('/auth/login', body.toString(), {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    })
    const setCookie: string[] = response.headers['set-cookie'] ?? []
    const sid = setCookie.find((c) => c.startsWith('SID='))
    if (!sid) throw new Error('qBittorrent refused the login')
    this.cookie = sid.split(';')[0]
  }
}

export const qbittorrentApi = new QBittorrentApi('http://127.0.0.1:8080/api/v2')

/**
 * qBittorrent's add endpoint answers "Ok." rather than telling you what it just
 * added, but a magnet always carries the infohash, so there is nothing to wait
 * for. Older links spell it in base32.
 */
export function infoHashFromMagnet(magnet: string): string {
  const match = /xt=urn:btih:([a-zA-Z0-9]+)/.exec(magnet)
  if (!match) throw new Error('Magnet link carries no infohash')

  const raw = match[1]
  if (raw.length === 40) return raw.toLowerCase()
  if (raw.length === 32) return base32ToHex(raw)
  throw new Error(`Unrecognised infohash in magnet: ${raw}`)
}

function base32ToHex(input: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''

  for (const character of input.toUpperCase()) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error(`Not base32: ${input}`)
    bits += index.toString(2).padStart(5, '0')
  }

  let hex = ''
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2)
      .toString(16)
      .padStart(2, '0')
  }
  return hex
}
