#!/usr/bin/node
import {uploadFiles, removeFiles, addPlaylist, hasFiles} from './utils'
import {appConfig} from './config'
import axios from 'axios'

const main = async () => {
  const torrentName = process.env.TR_TORRENT_NAME
  if (!hasFiles(torrentName)) {
    return
  }

  if (appConfig.S3_BUCKET) {
    const files = await uploadFiles(torrentName)
    if (files.length === 0) {
      return
    }

    removeFiles(torrentName)
    await addPlaylist(files, torrentName)
  }

  const hash = process.env.TR_TORRENT_HASH
  axios.post(`${appConfig.TRACKER_API_URL}/downloaded`, {
    hash,
    torrentName: `${torrentName}`,
    workerId: appConfig.WORKER_ID,
  })
}

main()
