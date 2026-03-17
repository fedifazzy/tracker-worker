import {appConfig, initWorker} from '../config'
import {createHttpClient} from '../http'
import {Task, TaskCompletePayload, TaskType} from '../models'
import {taskProcessor} from './task-processor'
import {progressReporter} from './progress-reporter'

export class TasksFetcher {
  private readonly fetchInterval = 5000
  private readonly httpClient = createHttpClient(appConfig.TRACKER_API_URL)
  private readonly username = appConfig.TG_USERNAME
  private workerId: string

  async start() {
    this.workerId = await initWorker()

    console.log(
      `Worker \x1b[33m${this.workerId}\x1b[0m registered for ${this.username}.\nStart downloads via bot https://t.me/feditracker_bot`
    )

    this.reportStarted()
    this.startFetch()
    progressReporter.start(this.workerId)
  }

  private async reportStarted() {
    const version = process.env.BUILD_SHA
    if (!version) return

    try {
      await this.httpClient.post('/started', {
        workerId: this.workerId,
        ownerUsername: this.username,
        version,
        changelog: process.env.BUILD_CHANGELOG || '',
      })
    } catch (error) {
      console.log("Can't report worker started", error?.message)
    }
  }

  private startFetch() {
    setInterval(() => {
      tasksFetcher.getTasks()
    }, this.fetchInterval)
  }

  async getTasks() {
    try {
      const response = await this.httpClient.get<Task[]>('/get-tasks', {
        params: {
          ownerUsername: this.username,
          workerId: this.workerId,
        },
      })

      for (const task of response.data) {
        try {
          const result = await taskProcessor.process(task)
          await this.taskDone(task.id, task.type, result)
        } catch (error) {
          console.error(`Failed to process task ${task.id} (${task.type}):`, error?.message)
        }
      }
    } catch (error) {
      console.log("Can't fetch tasks", error?.message)
    }
  }

  private async taskDone(id: number, type: TaskType, payload: TaskCompletePayload) {
    console.log('Task complete:', JSON.stringify({id, type, payload}))
    try {
      await this.httpClient.post('/task-done', {id, type, payload})
    } catch (error) {
      console.error(`Failed to report task ${id} completion:`, error?.message)
    }
  }
}

export const tasksFetcher = new TasksFetcher()
