import path from 'path'
import {DownloadingTorrent, StatusInfo, TorrentClient, TorrentListItem, TransmissionFileInfo} from '../models'
import {appConfig} from '../config'
import {infoHashFromMagnet, qbittorrentApi} from './qbittorrent-api'

type QbTorrent = {
  hash: string
  name: string
  size: number
  total_size: number
  progress: number
  state: string
  eta: number
  completed: number
  dlspeed: number
  priority: number
}

type QbFile = {
  index: number
  name: string
  size: number
}

/** States qBittorrent uses while bytes are still coming in. */
const DOWNLOADING_STATES = ['downloading', 'metaDL', 'stalledDL', 'forcedDL', 'queuedDL', 'checkingDL', 'allocating']
const SEEDING_STATES = ['uploading', 'stalledUP', 'forcedUP', 'queuedUP', 'checkingUP']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatEta(seconds: number): string {
  // qBittorrent says 8640000 rather than -1 when it has no idea.
  if (seconds < 0 || seconds >= 8640000) return 'Unknown'
  if (seconds < 60) return `${seconds} sec`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`
}

function stateToString(state: string): string {
  if (DOWNLOADING_STATES.indexOf(state) >= 0) return 'Downloading'
  if (SEEDING_STATES.indexOf(state) >= 0) return 'Seeding'
  if (state === 'pausedDL' || state === 'pausedUP') return 'Stopped'
  if (state === 'checkingResumeData' || state === 'moving') return 'Verifying'
  if (state === 'error' || state === 'missingFiles') return 'Error'
  return 'Unknown'
}

export class QBittorrentService implements TorrentClient {
  private readonly maxAttempts = 30
  private readonly attemptStepMS = 3000

  /**
   * Waits for the daemon the entrypoint started alongside this process, then
   * registers the completion hook.
   *
   * The hook cannot live in qBittorrent.conf: Qt's INI parser strips the quotes
   * around the arguments, so `done.js "%N" "%I"` arrives at the script as one
   * glued-together argument and the download is never reported to the bot. The
   * API takes JSON, which survives intact.
   */
  async applySettings(): Promise<void> {
    const doneScript = path.resolve(__dirname, '../done.js')

    const preferences: Record<string, unknown> = {
      autorun_enabled: true,
      autorun_program: `${doneScript} "%N" "%I"`,
    }

    // 4.5.2 ships with a password everybody knows, and it is stored hashed, so
    // it cannot be put in the config file — the API takes it in the clear and
    // hashes it. Requests from inside this container skip authentication
    // regardless, so setting one costs nothing here.
    if (appConfig.QBT_PASSWORD) {
      preferences.web_ui_username = appConfig.QBT_USERNAME || 'admin'
      preferences.web_ui_password = appConfig.QBT_PASSWORD
    }

    for (let attempt = 1; attempt <= 30; attempt++) {
      try {
        await qbittorrentApi.post('/app/setPreferences', {json: JSON.stringify(preferences)})
        return
      } catch (error: any) {
        if (attempt === 30) throw new Error(`qBittorrent never came up: ${error?.message}`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  /**
   * Sequential order and first/last piece priority are set as the torrent is
   * added rather than toggled afterwards, because the endpoints that change
   * them later are toggles: calling one on a torrent that already has the flag
   * turns it back off.
   *
   * They are on by default because a player reads a file from the front and
   * looks for the container's index at the very end, and a torrent that ignores
   * that order cannot be watched until it has finished.
   */
  async start(magnetLink: string): Promise<string> {
    const hash = infoHashFromMagnet(magnetLink)
    const sequential = appConfig.SEQUENTIAL_DOWNLOAD !== 'false'

    await qbittorrentApi.post('/torrents/add', {
      urls: magnetLink,
      sequentialDownload: sequential ? 'true' : 'false',
      firstLastPiecePrio: sequential ? 'true' : 'false',
    })
    return hash
  }

  async resume(hash: string): Promise<void> {
    await qbittorrentApi.post('/torrents/resume', {hashes: hash})
  }

  async stop(hash: string): Promise<void> {
    await qbittorrentApi.post('/torrents/pause', {hashes: hash})
  }

  async selectFile(hash: string, fileId: number | string): Promise<void> {
    const id = typeof fileId === 'string' ? Number(fileId) : fileId
    await qbittorrentApi.post('/torrents/filePrio', {hash, id, priority: 1})
  }

  async removeAndDelete(hash: string): Promise<void> {
    await qbittorrentApi.post('/torrents/delete', {hashes: hash, deleteFiles: 'true'})
  }

  /**
   * Transmission has a three-way bandwidth priority; qBittorrent has a queue
   * position instead. Moving to either end of the queue is the closest thing,
   * and it is why `listAll` cannot report back what was set.
   */
  async setBandwidthPriority(hash: string, priority: number): Promise<void> {
    if (priority > 0) await qbittorrentApi.post('/torrents/topPrio', {hashes: hash})
    else if (priority < 0) await qbittorrentApi.post('/torrents/bottomPrio', {hashes: hash})
  }

  async filesList(hash: string): Promise<TransmissionFileInfo[]> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt * this.attemptStepMS))

      const files = await this.files(hash)
      if (files.length === 0) continue

      return files.map((file) => ({id: file.index, filename: file.name}))
    }
    return []
  }

  /** Torrent order, which is the order the piece space is laid out in. */
  async files(hash: string): Promise<QbFile[]> {
    const files = await qbittorrentApi.get<QbFile[]>('/torrents/files', {hash})
    if (!Array.isArray(files)) return []
    return files.map((file, position) => ({...file, index: file.index ?? position})).sort((a, b) => a.index - b.index)
  }

  async getStatus(): Promise<StatusInfo[]> {
    const torrents = await this.info()

    return torrents
      .filter((torrent) => DOWNLOADING_STATES.indexOf(torrent.state) >= 0)
      .map((torrent) => ({
        name: torrent.name,
        status: stateToString(torrent.state),
        progress: `${Math.round(torrent.progress * 100)}%`,
        estimatedTime: formatEta(torrent.eta),
        downloadedSize: formatBytes(torrent.completed),
      }))
  }

  async listAll(): Promise<TorrentListItem[]> {
    const torrents = await this.info()

    return torrents.map((torrent) => ({
      name: torrent.name,
      hash: torrent.hash,
      totalSize: formatBytes(torrent.size ?? torrent.total_size),
      status: stateToString(torrent.state),
      progress: `${Math.round(torrent.progress * 100)}%`,
      downloadedSize: formatBytes(torrent.completed),
      estimatedTime: torrent.eta >= 0 && torrent.eta < 8640000 ? formatEta(torrent.eta) : null,
      priority: 0,
    }))
  }

  async getDownloadingTorrents(): Promise<DownloadingTorrent[]> {
    const torrents = await this.info()

    return torrents
      .filter(
        (torrent) =>
          DOWNLOADING_STATES.indexOf(torrent.state) >= 0 ||
          (SEEDING_STATES.indexOf(torrent.state) >= 0 && torrent.progress >= 0.99)
      )
      .map((torrent) => ({
        hash: torrent.hash,
        name: torrent.name,
        percentDone: Math.min(1, torrent.progress),
        rateDownload: torrent.dlspeed ?? 0,
        eta: SEEDING_STATES.indexOf(torrent.state) >= 0 ? 0 : torrent.eta,
      }))
  }

  private async info(): Promise<QbTorrent[]> {
    const torrents = await qbittorrentApi.get<QbTorrent[]>('/torrents/info')
    return Array.isArray(torrents) ? torrents : []
  }
}

export const qbittorrent = new QBittorrentService()
