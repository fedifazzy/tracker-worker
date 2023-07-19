process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
process.on('uncaughtException', (err) => {
  console.error(err?.message || err)
})

process.on('unhandledRejection', (rejection: any) => {
  console.error(rejection?.message || rejection)
})

import {tasksFetcher} from './services/tasks-fetcher'
tasksFetcher.start()
