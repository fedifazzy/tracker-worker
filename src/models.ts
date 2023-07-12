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

export type TaskPayload = AddTorrentTaskPayload | SelectFileTaskPayload

export type Task = AddTorrentTask | SelectFileTask

export type AddTorrentResult = {
  hash: string
  filesList: TransmissionFileInfo[]
}
export type TaskCompletePayload = AddTorrentResult | void

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

export type TaskCompleteMessage = AddTorrentCompleteMessage | SelectFileCompleteMessage
