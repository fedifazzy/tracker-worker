import path from 'path'
import {appConfig} from '../config'
import {CastResult, CastTaskPayload, TorrentFile} from '../models'
import {DlnaRenderer} from './dlna-renderer'
import {contentTypeFor, streamServer} from './stream-server'
import {torrentClient} from './torrent-client'

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.ts', '.webm', '.mpg', '.mpeg']

/**
 * The largest video file in the torrent. Releases routinely ship a `sample.mkv`
 * beside the feature, along with subtitles and artwork, and size separates them
 * reliably where names do not.
 */
export function pickPlayableFile(files: TorrentFile[]): TorrentFile | null {
  if (files.length === 0) return null

  const videos = files.filter((file) => VIDEO_EXTENSIONS.indexOf(path.extname(file.name).toLowerCase()) >= 0)
  const candidates = videos.length > 0 ? videos : files

  return candidates.reduce((best, file) => (file.size > best.size ? file : best))
}

export class CastService {
  private renderer: DlnaRenderer | null = null

  /**
   * Hands the renderer a URL on this worker's stream server and tells it to
   * play. The torrent does not have to be finished — the stream server blocks
   * on pieces that have not landed instead of serving the holes as zeros, which
   * is the whole reason casting does not just point at the file on disk.
   */
  async cast({hash, fileIndex}: CastTaskPayload): Promise<CastResult> {
    const host = appConfig.STREAM_HOST
    const port = Number(appConfig.STREAM_PORT)

    // The address has to be configured: inside a bridged container the worker
    // only sees its own 172.x address, which is not one the television can dial.
    if (!host) throw new Error('STREAM_HOST is not set, so there is no address to give the renderer')
    if (!port) throw new Error('STREAM_PORT is not set, so the stream server is not running')
    if (!appConfig.DLNA_RENDERER_URL) throw new Error('DLNA_RENDERER_URL is not set')

    const files = await torrentClient.files(hash)
    const file = fileIndex === undefined ? pickPlayableFile(files) : files[fileIndex]
    if (!file) throw new Error(`Torrent ${hash} holds nothing playable`)

    const name = path.basename(file.name)
    const url = `http://${host}:${port}${streamServer.pathFor(hash, file.index, name)}`

    if (!this.renderer) this.renderer = new DlnaRenderer(appConfig.DLNA_RENDERER_URL)
    await this.renderer.play({url, title: name, mime: contentTypeFor(name), size: file.size})

    return {title: name, url}
  }
}

export const castService = new CastService()
