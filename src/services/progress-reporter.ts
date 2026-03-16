import axios from 'axios'
import {appConfig} from '../config'
import {transmission} from './transmission-service'

export class ProgressReporter {
  private readonly reportInterval = 15000
  private readonly httpClient = axios.create({baseURL: appConfig.TRACKER_API_URL})
  private intervalId: ReturnType<typeof setInterval> | null = null

  start(workerId: string) {
    this.intervalId = setInterval(() => {
      this.report(workerId)
    }, this.reportInterval)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async report(workerId: string) {
    try {
      const torrents = await transmission.getDownloadingTorrents()
      if (torrents.length === 0) return

      await this.httpClient.post('/progress', {workerId, torrents})
    } catch (error: any) {
      console.log("Can't report progress", error?.message)
    }
  }
}

export const progressReporter = new ProgressReporter()
