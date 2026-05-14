import {StatusInfo, TorrentListItem, TransmissionFileInfo} from '../models'
import {transmissionRpc} from './transmission-rpc'

const TRANSMISSION_STATUS_DOWNLOADING = 4
const TRANSMISSION_STATUS_SEEDING = 6

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatEta(seconds: number): string {
  if (seconds < 0) return 'Unknown'
  if (seconds < 60) return `${seconds} sec`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`
}

function statusNumberToString(status: number): string {
  switch (status) {
    case 0: return 'Stopped'
    case 1: return 'Queued to verify'
    case 2: return 'Verifying'
    case 3: return 'Queued to download'
    case 4: return 'Downloading'
    case 5: return 'Queued to seed'
    case 6: return 'Seeding'
    default: return 'Unknown'
  }
}

export class TransmissionService {
  private readonly uiUrl = 'http://localhost:9091/torrent'

  constructor() {
    console.log(`Transmission UI: ${this.uiUrl}/web/`)
  }

  async start(magnetLink: string): Promise<string> {
    const res = await transmissionRpc.request('torrent-add', {filename: magnetLink})
    const added = res.arguments?.['torrent-added'] ?? res.arguments?.['torrent-duplicate']
    if (!added?.hashString) {
      throw new Error('Failed to add torrent: no hashString in response')
    }
    return added.hashString.toLowerCase()
  }

  async resume(hash: string): Promise<void> {
    await transmissionRpc.request('torrent-start', {ids: [hash]})
  }

  async stop(hash: string): Promise<void> {
    await transmissionRpc.request('torrent-stop', {ids: [hash]})
  }

  async deselectAll(hash: string): Promise<void> {
    await transmissionRpc.request('torrent-set', {ids: [hash], 'files-unwanted': []})
  }

  async selectFile(hash: string, fileId: number | string) {
    const id = typeof fileId === 'string' ? Number(fileId) : fileId
    await transmissionRpc.request('torrent-set', {ids: [hash], 'files-wanted': [id]})
  }

  async removeAndDelete(hash: string): Promise<void> {
    await transmissionRpc.request('torrent-remove', {ids: [hash], 'delete-local-data': true})
  }

  async setBandwidthPriority(hash: string, priority: number): Promise<void> {
    await transmissionRpc.request('torrent-set', {ids: [hash], bandwidthPriority: priority})
  }

  private readonly maxAttempts = 30
  private readonly attemptStepMS = 3000

  async filesList(hash: string): Promise<TransmissionFileInfo[]> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, attempt * this.attemptStepMS))
      const res = await transmissionRpc.request('torrent-get', {
        ids: [hash],
        fields: ['files'],
      })
      const torrent = res.arguments?.torrents?.[0]
      if (!torrent?.files?.length) continue

      return torrent.files.map((f: any, idx: number) => ({
        id: idx,
        filename: f.name,
      }))
    }
    return []
  }

  async getStatus(): Promise<StatusInfo[]> {
    const res = await transmissionRpc.request('torrent-get', {
      fields: ['name', 'status', 'percentDone', 'eta', 'rateDownload', 'sizeWhenDone', 'haveValid'],
    })
    const torrents: any[] = res.arguments?.torrents ?? []

    return torrents
      .filter((t) => t.status === TRANSMISSION_STATUS_DOWNLOADING)
      .map((t) => ({
        name: t.name,
        status: statusNumberToString(t.status),
        progress: `${Math.round(t.percentDone * 100)}%`,
        estimatedTime: formatEta(t.eta),
        downloadedSize: formatBytes(t.haveValid),
      }))
  }

  async listAll(): Promise<TorrentListItem[]> {
    const res = await transmissionRpc.request('torrent-get', {
      fields: ['name', 'hashString', 'totalSize', 'status', 'percentDone', 'eta', 'haveValid', 'bandwidthPriority'],
    })
    const torrents: any[] = res.arguments?.torrents ?? []

    return torrents.map((t) => ({
      name: t.name,
      hash: t.hashString,
      totalSize: formatBytes(t.totalSize),
      status: statusNumberToString(t.status),
      progress: `${Math.round(t.percentDone * 100)}%`,
      downloadedSize: formatBytes(t.haveValid),
      estimatedTime: t.eta >= 0 ? formatEta(t.eta) : null,
      priority: t.bandwidthPriority ?? 0,
    }))
  }

  async getDownloadingTorrents(): Promise<Array<{
    hash: string
    name: string
    percentDone: number
    rateDownload: number
    eta: number
  }>> {
    const res = await transmissionRpc.request('torrent-get', {
      fields: ['name', 'hashString', 'percentDone', 'rateDownload', 'eta', 'status'],
    })
    const torrents: any[] = res.arguments?.torrents ?? []

    return torrents
      .filter(
        (t) =>
          t.status === TRANSMISSION_STATUS_DOWNLOADING ||
          (t.status === TRANSMISSION_STATUS_SEEDING && t.percentDone >= 0.99)
      )
      .map((t) => ({
        hash: t.hashString,
        name: t.name,
        percentDone: Math.min(1, t.percentDone),
        rateDownload: t.rateDownload ?? 0,
        eta: t.status === TRANSMISSION_STATUS_SEEDING ? 0 : t.eta,
      }))
  }
}

export const transmission = new TransmissionService()
