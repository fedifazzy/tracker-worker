import { exec } from 'child_process'
import { StatusInfo, TransmissionFileInfo } from '../models'

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
          console.error('transmission-remote error:', error.message)
          if (stderr) console.error('stderr:', stderr)
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
    // Skip the first 2 header lines and the last empty line
    rows.splice(0, 2)
    rows.splice(-1)

    return rows
      .filter((row) => row.trim().length > 0)
      .map((row) => {
        // Format: "  0: 100% Normal   Yes   6.72 MB  Filename.ext"
        // The id is before the first colon
        const colonIndex = row.indexOf(':')
        if (colonIndex === -1) return null

        const id = Number(row.substring(0, colonIndex).trim())
        const rest = row.substring(colonIndex + 1).trim()

        // Parse: "100% Normal   Yes   6.72 MB  Filename.ext"
        // Use regex to match: percentage, priority, get, size+unit, then filename
        const match = rest.match(
          /^\s*(\d+%|n\/a)\s+(Low|Normal|High)\s+(Yes|No)\s+[\d.]+\s+\S+\s{2,}(.+)$/
        )

        if (match) {
          return {
            id,
            filename: match[4].trim(),
          }
        }

        // Fallback: try to get filename after double-space near the end
        const parts = rest.split(/\s{2,}/)
        const filename = parts.length > 0 ? parts[parts.length - 1].trim() : rest.trim()

        return {
          id,
          filename,
        }
      })
      .filter((item): item is TransmissionFileInfo => item !== null)
  }

  private parseStatusInfoList(stdout: string): StatusInfo[] {
    const rows = stdout.split('\n')
    rows.splice(0, 1)
    rows.splice(-2)

    return rows.map(torrentInfoRow => {
      const torrentInfoParts = torrentInfoRow.split('  ').filter(Boolean)
      const name = torrentInfoParts.at(8)?.trim() || ''
      const status = torrentInfoParts.at(7)?.trim() || ''
      const estimatedTime = torrentInfoParts.at(3)?.trim() || ''
      const progress = torrentInfoParts.at(1)?.trim() || ''
      const downloadedSize = torrentInfoParts.at(2)?.trim() || ''
      return { name, status, progress, estimatedTime, downloadedSize }
    }).filter(item => item.estimatedTime !== 'Done')
  }

  async getStatus(): Promise<StatusInfo[]> {
    const stdout = await this.exec('-l')
    return this.parseStatusInfoList(stdout)
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
  private readonly attemptStepMS = 3000

  private async retrieveFiles(hash: string, attempt: number) {
    return new Promise<TransmissionFileInfo[]>((resolve) => {
      const waitTime = attempt * this.attemptStepMS
      setTimeout(async () => {
        try {
          const stdout = await this.exec(`-t ${hash} -f`)
          const filesList = this.parseFileList(stdout)
          resolve(filesList)
        } catch (error) {
          console.error(`retrieveFiles attempt ${attempt} failed:`, error?.message || error)
          resolve([])
        }
      }, waitTime)
    })
  }

  async filesList(hash: string): Promise<TransmissionFileInfo[]> {
    let currentAttempt = 1
    while (currentAttempt <= this.maxAttempts) {
      const filesList = await this.retrieveFiles(hash, currentAttempt)
      if (filesList.length > 0) {
        return filesList
      }
      currentAttempt++
    }

    return []
  }

  async selectFile(hash: string, fileId: number | string) {
    await this.exec(`-t ${hash} -g${fileId}`)
  }
}

export const transmission = new TransmissionService()
