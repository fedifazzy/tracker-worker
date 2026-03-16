#!/usr/bin/node
import {uploadFiles, removeFiles, addPlaylist, hasFiles} from './utils'
import {appConfig} from './config'
import axios from 'axios'
import {appendFileSync} from 'fs'

const debugLog = (msg: string, data?: any) => {
  try {
    appendFileSync('/var/www/html/downloads/debug-done.log', JSON.stringify({sessionId:'f3c579',location:'done.ts',message:msg,data,timestamp:Date.now()}) + '\n')
  } catch {}
}

const main = async () => {
  const torrentName = process.env.TR_TORRENT_NAME
  const hash = process.env.TR_TORRENT_HASH
  // #region agent log
  debugLog('done.ts started', {torrentName, hash, TRACKER_API_URL: appConfig.TRACKER_API_URL, WORKER_ID: appConfig.WORKER_ID, S3_BUCKET: appConfig.S3_BUCKET})
  // #endregion
  if (!hasFiles(torrentName)) {
    // #region agent log
    debugLog('hasFiles returned false, exiting early', {torrentName})
    // #endregion
    return
  }
  // #region agent log
  debugLog('hasFiles returned true', {torrentName})
  // #endregion

  if (appConfig.S3_BUCKET) {
    const files = await uploadFiles(torrentName)
    if (files.length === 0) {
      // #region agent log
      debugLog('uploadFiles returned empty, exiting early')
      // #endregion
      return
    }

    removeFiles(torrentName)
    await addPlaylist(files, torrentName)
  }

  // #region agent log
  debugLog('sending /downloaded request', {hash, torrentName, workerId: appConfig.WORKER_ID, url: `${appConfig.TRACKER_API_URL}/downloaded`})
  // #endregion
  try {
    const res = await axios.post(`${appConfig.TRACKER_API_URL}/downloaded`, {
      hash,
      torrentName: `${torrentName}`,
      workerId: appConfig.WORKER_ID,
    })
    // #region agent log
    debugLog('axios.post success', {status: res.status, data: res.data})
    // #endregion
  } catch (e) {
    // #region agent log
    debugLog('axios.post failed', {error: e?.message, code: e?.code})
    // #endregion
  }
}

main()
