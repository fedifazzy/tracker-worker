import {exec} from 'child_process'
import {TransmissionFileInfo} from '../models'

export class TransmissionService {
  private readonly url = 'http://localhost:9091/torrent'
  onDone(_hash: string): void {
    // @todo
    // Potential memory leak if not call:
    // deleteHash(hash)
    // But keeping hash allows to downdload new files after torrent is 'done'
  }

  constructor() {
    console.log(`Transmission UI: ${this.url}/web/`)
  }

  private async exec(params: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`transmission-remote ${this.url} -n 'fedifazzy:transmission' ${params}`, (error, stdout, stderr) => {
        if (error) {
          console.error(error)
          reject(error)
          return
        }
        resolve(stdout)
      })
    })
  }

  private getTorrentHash = (link: string): string => {
    return link.match(/btih:(.*)&/)![1].toLowerCase()
  }

  private parseFileList(stdout: string): TransmissionFileInfo[] {
    const rows = stdout.split('\n')
    rows.splice(0, 2)
    rows.splice(-1)
    return rows.map((row) => {
      const [id, fileInfoRow] = row.split(':')
      const filename = fileInfoRow.split('/').at(-1)
      return {
        id: Number(id),
        filename,
      }
    })
  }

  async start(magnetLink: string): Promise<string> {
    const hash = this.getTorrentHash(magnetLink)
    await this.exec(`-a "${magnetLink}" -s`)
    return hash
  }

  async resume(hash: string): Promise<void> {
    await this.exec(`-t "${hash}" -s`)
  }

  async stop(hash: string): Promise<void> {
    await this.exec(`-t "${hash}" -S`)
  }

  async deselectAll(hash: string): Promise<void> {
    await this.exec(`-t ${hash} -Gall`)
  }

  private readonly maxAttempts = 30
  private readonly attemptStepMS = 1000
  private currentAttempt = 1
  private async retrieveFiles(hash: string) {
    return new Promise<TransmissionFileInfo[]>((resolve) => {
      const waitTime = this.currentAttempt * this.attemptStepMS
      setTimeout(async () => {
        const stdout = await this.exec(`-t ${hash} -f`)
        const filesList = this.parseFileList(stdout)
        resolve(filesList)
      }, waitTime)
    })
  }

  async filesList(hash: string): Promise<TransmissionFileInfo[]> {
    while (this.currentAttempt <= this.maxAttempts) {
      const filesList = await this.retrieveFiles(hash)
      if (filesList.length > 0) {
        this.currentAttempt = 0
        return filesList
      }
      this.currentAttempt++
    }
  }

  async selectFile(hash: string, fileId: number | string) {
    await this.exec(`-t ${hash} -g${fileId}`)
  }
}

export const transmission = new TransmissionService()
