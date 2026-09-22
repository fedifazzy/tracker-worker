process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
process.on('uncaughtException', (err) => {
  console.error(err?.message || err)
})

process.on('unhandledRejection', (rejection: any) => {
  console.error(rejection?.message || rejection)
})

import {appConfig} from './config'
import {tasksFetcher} from './services/tasks-fetcher'
import {streamServer} from './services/stream-server'

tasksFetcher.start()

// Off unless a port is configured: the stream server has no authentication and
// belongs on the LAN only, so turning it on has to be a deliberate act.
const streamPort = Number(appConfig.STREAM_PORT)
if (streamPort) streamServer.listen(streamPort)
