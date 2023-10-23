export type TransmissionFileInfo = {
  id: number
  filename: string
}

export type AddTorrentTaskPayload = {
  magnetLink: string
}

export type SelectFileTaskPayload = {
  hash: string
  fileId: number | string
}

export const enum TaskType {
  ADD_TORRENT,
  SELECT_FILE,
  GET_STATUS,
}

type TaskBase = {
  id: number
  type: TaskType
}

type AddTorrentTask = TaskBase & {
  type: TaskType.ADD_TORRENT
  payload: AddTorrentTaskPayload
}

type SelectFileTask = TaskBase & {
  type: TaskType.SELECT_FILE
  payload: SelectFileTaskPayload
}

type GetStatusTask = TaskBase & {
  type: TaskType.GET_STATUS
}

export type TaskPayload = AddTorrentTaskPayload | SelectFileTaskPayload

export type Task = AddTorrentTask | SelectFileTask | GetStatusTask

export type AddTorrentResult = {
  hash: string
  filesList: TransmissionFileInfo[]
}

export type TaskCompletePayload = AddTorrentResult | StatusInfo[] | void

type AddTorrentCompleteMessage = {
  id: number
  type: TaskType.ADD_TORRENT
  payload: AddTorrentResult
}

type SelectFileCompleteMessage = {
  id: number
  type: TaskType.SELECT_FILE
  payload: void
}

type GetStatusCompleteMessage = {
  id: number
  type: TaskType.GET_STATUS
  payload: StatusInfo
}

export type StatusInfo = {
  name: string
  status: string
  estimatedTime: string
  progress: string
  downloadedSize: string
}

export type TaskCompleteMessage = AddTorrentCompleteMessage | SelectFileCompleteMessage | GetStatusCompleteMessage
