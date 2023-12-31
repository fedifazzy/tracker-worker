import path from 'path'
import fs from 'fs'
import {random} from './services/random'

type Config = {
  [K in (typeof AppConfig.fields)[number]]: string
}

class AppConfig {
  static readonly fields = [
    'TRACKER_API_URL',
    'TG_USERNAME',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET',
    'S3_REGION',
    'WORKER_ID',
  ] as const

  private readonly requiredFiedls: Partial<typeof AppConfig.fields> = ['TRACKER_API_URL', 'TG_USERNAME']
  private readonly envPath = path.resolve(__dirname, '../.env')

  private container: Config

  constructor() {
    this.init()
    this.validate()
  }

  async initWorkerName() {
    if (!this.container.WORKER_ID) {
      this.container.WORKER_ID = await random.generateName()
    }
    this.shareForTransmissionDoneScript()
    return this.container.WORKER_ID
  }

  private init(): void {
    require('dotenv').config({path: this.envPath})
    this.container = AppConfig.fields.reduce((acc, field) => {
      acc[field] = process.env[field]
      return acc
    }, {} as Config)
  }

  private shareForTransmissionDoneScript(): void {
    if (process.env.TR_APP_VERSION) {
      return
    }
    fs.writeFileSync(
      this.envPath,
      Object.entries(this.container)
        .map(([key, value]) => `${key}=${value || ''}`)
        .join('\n'),
      {
        mode: 0o777,
      }
    )
  }

  private validate(): void {
    for (const field of this.requiredFiedls) {
      if (!this.container[field]) {
        throw new Error(`Не задан ${field}`)
      }
    }
  }

  get value(): Config {
    return this.container
  }
}

const configInstance = new AppConfig()

export const initWorker = async () => {
  return await configInstance.initWorkerName()
}

export const appConfig = configInstance.value
