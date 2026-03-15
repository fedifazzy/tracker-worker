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

export type DeleteFilesTaskPayload = {
  hash: string
}

export type TorrentListItem = {
  name: string
  hash: string
}

export const enum TaskType {
  ADD_TORRENT,
  SELECT_FILE,
  GET_STATUS,
  DELETE_FILES,
  LIST_TORRENTS,
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

type DeleteFilesTask = TaskBase & {
  type: TaskType.DELETE_FILES
  payload: DeleteFilesTaskPayload
}

type ListTorrentsTask = TaskBase & {
  type: TaskType.LIST_TORRENTS
}

export type TaskPayload = AddTorrentTaskPayload | SelectFileTaskPayload | DeleteFilesTaskPayload

export type Task = AddTorrentTask | SelectFileTask | GetStatusTask | DeleteFilesTask | ListTorrentsTask

export type AddTorrentResult = {
  hash: string
  filesList: TransmissionFileInfo[]
}

export type TaskCompletePayload = AddTorrentResult | StatusInfo[] | TorrentListItem[] | void

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

type DeleteFilesCompleteMessage = {
  id: number
  type: TaskType.DELETE_FILES
  payload: void
}

type ListTorrentsCompleteMessage = {
  id: number
  type: TaskType.LIST_TORRENTS
  payload: TorrentListItem[]
}

export type StatusInfo = {
  name: string
  status: string
  estimatedTime: string
  progress: string
  downloadedSize: string
}

export type TaskCompleteMessage =
  | AddTorrentCompleteMessage
  | SelectFileCompleteMessage
  | GetStatusCompleteMessage
  | DeleteFilesCompleteMessage
  | ListTorrentsCompleteMessage
