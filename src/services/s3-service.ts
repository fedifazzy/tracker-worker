import {CompleteMultipartUploadCommandOutput, S3Client} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import {ReadStream} from 'fs'
import {appConfig} from '../config'

class S3Service {
  private readonly bucket = appConfig.S3_BUCKET
  private client: S3Client

  constructor() {
    this.init()
  }

  private init(): void {
    if (!appConfig.S3_BUCKET) {
      return
    }

    this.client = new S3Client({
      region: appConfig.S3_REGION,
      credentials: {
        accessKeyId: appConfig.S3_ACCESS_KEY,
        secretAccessKey: appConfig.S3_SECRET,
      },
    })
  }

  async upload(Key: string, Body: ReadStream | ReadableStream): Promise<CompleteMultipartUploadCommandOutput> {
    console.info('Upload start:', Key)
    const parallelUploads3 = new Upload({
      client: this.client,
      params: {Bucket: this.bucket, Key, Body, ACL: 'public-read'},
    })

    return await parallelUploads3.done()
  }
}

export const s3Service = new S3Service()
