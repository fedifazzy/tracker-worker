import {globSync} from 'glob'
import {s3Service} from './services/s3-service'
import {createReadStream, rmSync, mkdir} from 'fs'
import {Readable} from 'stream'

const downloadsDir = '/var/www/html/downloads/'

export const removeFiles = (path: string) => {
  const fullPath = `${downloadsDir}${path}`
  rmSync(fullPath, {recursive: true, force: true})
  mkdir(fullPath, (err) => {
    if (err) {
      throw new Error(err.message)
    }
  })
}

export const hasFiles = (subdir) => {
  const files = globSync('**', {cwd: `${downloadsDir}${subdir}`})
  return files.length !== 0
}

export const uploadFiles = async (subdir: string) => {
  const uploadedFilesUrls: string[] = []
  const files = globSync('**', {
    cwd: `${downloadsDir}${subdir}`,
    nodir: true,
    withFileTypes: true,
  }).sort((a, b) => (a.name > b.name ? 1 : -1))

  for (const file of files) {
    console.log('Uploading', file.name)
    const extension = file.name.split('.').at(-1).toLowerCase()
    if (extension === 'part') {
      continue
    }
    const fullPath = file.fullpath()
    const stream = createReadStream(fullPath)
    const key = `${subdir}/${file.name}`
    const {Location} = await s3Service.upload(key, stream)
    uploadedFilesUrls.push(Location)
  }

  return uploadedFilesUrls
}

export const addPlaylist = async (urls: string[], prefix: string): Promise<void> => {
  if (urls.length < 3) {
    return
  }
  const m3uContent = urls.join('\n')
  await s3Service.upload(`${prefix}/playlist.m3u`, Readable.from([m3uContent]))
}
