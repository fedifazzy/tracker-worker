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

/**
 * Qt converts file paths through the locale's codec, so a non-UTF-8 locale
 * makes qBittorrent write mangled names and then fail to find them again. The
 * Dockerfile sets LANG, and this is the alarm for the day something strips it:
 * the symptom otherwise shows up as Cyrillic filenames turning into dots.
 */
export function localeIsUtf8(env: NodeJS.ProcessEnv): boolean {
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || ''
  return /utf-?8/i.test(locale)
}

/** Applies whatever the selected engine cannot be configured for from a file. */
export async function initTorrentClient(): Promise<void> {
  if (!useQBittorrent) return

  if (!localeIsUtf8(process.env)) {
    console.error(
      `Locale is not UTF-8 (LANG="${process.env.LANG || ''}"). qBittorrent will mangle ` +
        'non-ASCII file names and then be unable to find them. Set LANG=C.UTF-8.'
    )
  }

  await qbittorrent.applySettings()
}
