import {
  AddTorrentTaskPayload,
  AddTorrentResult,
  DeleteFilesTaskPayload,
  SelectFileTaskPayload,
  SetPriorityTaskPayload,
  Task,
  TaskCompletePayload,
  TaskType,
  TorrentListItem,
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
      case TaskType.GET_STATUS:
        return this.getStatus()
      case TaskType.DELETE_FILES:
        return this.deleteFiles(task.payload)
      case TaskType.LIST_TORRENTS:
        return this.listTorrents()
      case TaskType.SET_PRIORITY:
        return this.setPriority(task.payload)
    }
  }

  async addTorrent({magnetLink}: AddTorrentTaskPayload): Promise<AddTorrentResult> {
    const hash = await transmission.start(magnetLink)
    const filesList = await transmission.filesList(hash)

    return {
      hash,
      filesList,
    }
  }

  async selectFiles({hash, fileId}: SelectFileTaskPayload) {
    await transmission.selectFile(hash, fileId)
    await transmission.resume(hash)
  }

  async getStatus() {
    return await transmission.getStatus()
  }

  async deleteFiles({hash}: DeleteFilesTaskPayload) {
    await transmission.removeAndDelete(hash)
  }

  async listTorrents(): Promise<TorrentListItem[]> {
    return await transmission.listAll()
  }

  async setPriority({hash, priority}: SetPriorityTaskPayload): Promise<void> {
    await transmission.setBandwidthPriority(hash, priority)
  }
}

export const taskProcessor = new TaskProcessor()
