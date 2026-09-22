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

export type SetPriorityTaskPayload = {
  hash: string
  priority: number
}

export type TorrentListItem = {
  name: string
  hash: string
  totalSize: string
  status: string | null
  progress: string | null
  downloadedSize: string | null
  estimatedTime: string | null
  priority?: number
}

export type DownloadingTorrent = {
  hash: string
  name: string
  percentDone: number
  rateDownload: number
  eta: number
}

/**
 * What the rest of the worker needs from a torrent engine. Transmission and
 * qBittorrent both implement it, and TORRENT_CLIENT picks between them — the
 * point being that switching engines is reversible with one variable.
 */
export interface TorrentClient {
  start(magnetLink: string): Promise<string>
  resume(hash: string): Promise<void>
  stop(hash: string): Promise<void>
  selectFile(hash: string, fileId: number | string): Promise<void>
  removeAndDelete(hash: string): Promise<void>
  setBandwidthPriority(hash: string, priority: number): Promise<void>
  filesList(hash: string): Promise<TransmissionFileInfo[]>
  getStatus(): Promise<StatusInfo[]>
  listAll(): Promise<TorrentListItem[]>
  getDownloadingTorrents(): Promise<DownloadingTorrent[]>
}

export const enum TaskType {
  ADD_TORRENT,
  SELECT_FILE,
  GET_STATUS,
  DELETE_FILES,
  LIST_TORRENTS,
  SET_PRIORITY,
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

type SetPriorityTask = TaskBase & {
  type: TaskType.SET_PRIORITY
  payload: SetPriorityTaskPayload
}

type ListTorrentsTask = TaskBase & {
  type: TaskType.LIST_TORRENTS
}

export type TaskPayload =
  AddTorrentTaskPayload | SelectFileTaskPayload | DeleteFilesTaskPayload | SetPriorityTaskPayload

export type Task =
  AddTorrentTask | SelectFileTask | GetStatusTask | DeleteFilesTask | SetPriorityTask | ListTorrentsTask

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

type SetPriorityCompleteMessage = {
  id: number
  type: TaskType.SET_PRIORITY
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
  | SetPriorityCompleteMessage
  | ListTorrentsCompleteMessage

export type TorrentProgress = {
  hash: string
  name: string
  percentDone: number
  rateDownload: number
  eta: number
}
