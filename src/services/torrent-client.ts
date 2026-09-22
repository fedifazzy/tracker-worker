import {TorrentClient} from '../models'
import {PieceSource} from './piece-map'
import {appConfig} from '../config'
import {transmission} from './transmission-service'
import {qbittorrent} from './qbittorrent-service'
import {transmissionPieces} from './torrent-pieces'
import {qbittorrentPieces} from './qbittorrent-pieces'

/**
 * Transmission stays the default so an upgrade changes nothing on its own.
 * Streaming a torrent that is still downloading needs qBittorrent: Debian ships
 * Transmission 3.00, which has no sequential download at all, and without it
 * pieces arrive rarest-first and a player waits forever.
 */
const useQBittorrent = appConfig.TORRENT_CLIENT === 'qbittorrent'

export const torrentClient: TorrentClient = useQBittorrent ? qbittorrent : transmission
export const pieceSource: PieceSource = useQBittorrent ? qbittorrentPieces : transmissionPieces

console.log(
  useQBittorrent ? 'qBittorrent WebUI: http://localhost:8080/' : 'Transmission UI: http://localhost:9091/torrent/web/'
)

/** Applies whatever the selected engine cannot be configured for from a file. */
export async function initTorrentClient(): Promise<void> {
  if (useQBittorrent) await qbittorrent.applySettings()
}
