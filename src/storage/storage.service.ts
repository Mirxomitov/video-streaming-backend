import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class StorageService {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET')

    this.client = new S3Client({
      region: this.config.get<string>('STORAGE_REGION', 'us-east-1'),
      endpoint: this.config.getOrThrow<string>('STORAGE_ENDPOINT'),
      forcePathStyle: this.config.get<boolean>('STORAGE_FORCE_PATH_STYLE', true),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('STORAGE_SECRET_ACCESS_KEY'),
      },
    })
  }

  async create_upload_url(key: string, content_type: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: content_type,
    })

    return getSignedUrl(this.client, command, { expiresIn: 15 * 60 })
  }
}
