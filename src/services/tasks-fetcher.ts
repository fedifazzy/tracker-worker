import axios from 'axios'
import {appConfig} from '../config'
import {Task, TaskCompletePayload, TaskType} from '../models'
import {taskProcessor} from './task-processor'

export class TasksFetcher {
  private readonly httpClient = axios.create({baseURL: appConfig.TRACKER_API_URL})
  private readonly username = appConfig.TG_USERNAME

  async register() {
    const response = await this.httpClient.post('/register', {
      username: this.username,
    })

    const {interval} = response.data
    if (typeof interval !== 'number') {
      console.log('Backend answered no interval')
      return
    }

    console.log(`Worker registered for ${this.username}.\nStart downloads via bot https://t.me/feditracker_bot`)

    this.startFetch(interval)
  }

  private startFetch(interval: number) {
    setInterval(() => {
      tasksFetcher.getTasks()
    }, interval)
  }

  async getTasks() {
    try {
      const response = await this.httpClient.get<Task[]>('/get-tasks', {
        params: {
          username: this.username,
        },
      })

      response.data.forEach(async (task) => {
        const result = await taskProcessor.process(task)
        this.taskDone(task.id, task.type, result)
      })
    } catch (error) {
      console.log("Can't fetch tasks", error?.message)
    }
  }

  private async taskDone(id: number, type: TaskType, payload: TaskCompletePayload) {
    console.log('Task complete:', JSON.stringify({id, type, payload}))
    this.httpClient.post('/task-done', {
      id,
      type,
      payload,
    })
  }
}

export const tasksFetcher = new TasksFetcher()
