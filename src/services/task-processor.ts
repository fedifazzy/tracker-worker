import {
  AddTorrentTaskPayload,
  AddTorrentResult,
  CastResult,
  CastTaskPayload,
  DeleteFilesTaskPayload,
  SelectFileTaskPayload,
  SetPriorityTaskPayload,
  Task,
  TaskCompletePayload,
  TaskType,
  TorrentListItem,
} from '../models'
import {castService} from './cast'
import {torrentClient} from './torrent-client'

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
      case TaskType.CAST:
        return this.cast(task.payload)
    }
  }

  async addTorrent({magnetLink}: AddTorrentTaskPayload): Promise<AddTorrentResult> {
    const hash = await torrentClient.start(magnetLink)
    const filesList = await torrentClient.filesList(hash)

    return {
      hash,
      filesList,
    }
  }

  async selectFiles({hash, fileId}: SelectFileTaskPayload) {
    await torrentClient.selectFile(hash, fileId)
    await torrentClient.resume(hash)
  }

  async getStatus() {
    return await torrentClient.getStatus()
  }

  async deleteFiles({hash}: DeleteFilesTaskPayload) {
    await torrentClient.removeAndDelete(hash)
  }

  async listTorrents(): Promise<TorrentListItem[]> {
    return await torrentClient.listAll()
  }

  async setPriority({hash, priority}: SetPriorityTaskPayload): Promise<void> {
    await torrentClient.setBandwidthPriority(hash, priority)
  }

  async cast(payload: CastTaskPayload): Promise<CastResult> {
    return await castService.cast(payload)
  }
}

export const taskProcessor = new TaskProcessor()
