import {
  AddTorrentTaskPayload,
  AddTorrentResult,
  SelectFileTaskPayload,
  Task,
  TaskCompletePayload,
  TaskType,
} from '../models'
import {transmission} from './transmission-service'

export class TaskProcessor {
  async process(task: Task): Promise<TaskCompletePayload> {
    console.log('Processing task', JSON.stringify(task))
    switch (task.type) {
      case TaskType.ADD_TORRENT:
        return this.addTorrent(task.payload)
      case TaskType.SELECT_FILE:
        return this.selectFiles(task.payload)
    }
  }

  async addTorrent({magnetLink}: AddTorrentTaskPayload): Promise<AddTorrentResult> {
    const hash = await transmission.start(magnetLink)
    const filesList = await transmission.filesList(hash)
    await transmission.stop(hash)
    await transmission.deselectAll(hash)

    return {
      hash,
      filesList,
    }
  }

  async selectFiles({hash, fileId}: SelectFileTaskPayload) {
    await transmission.selectFile(hash, fileId)
    await transmission.resume(hash)
  }
}

export const taskProcessor = new TaskProcessor()
