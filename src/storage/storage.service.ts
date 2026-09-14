import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { dirname } from 'node:path'

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly public_base_url: string
  private readonly set_public_policy: boolean

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET')
    this.public_base_url = this.config.getOrThrow<string>('STORAGE_PUBLIC_BASE_URL').replace(/\/$/, '')
    this.set_public_policy = this.config.get<boolean>('STORAGE_SET_PUBLIC_POLICY', true)

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

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
    }

    if (this.set_public_policy) {
      // Development convenience: objects can be fetched directly by the player.
      // In production use a CDN/private policy instead.
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            }],
          }),
        }),
      )
    }
  }

  async create_upload_url(key: string, content_type: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: content_type,
    })

    return getSignedUrl(this.client, command, { expiresIn: 15 * 60 })
  }

  async download_to_file(key: string, file_path: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    if (!response.Body) throw new Error(`Storage object is empty: ${key}`)
    await mkdir(dirname(file_path), { recursive: true })
    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(file_path))
  }

  async upload_file(file_path: string, key: string, content_type: string) {
    const { createReadStream } = await import('node:fs')
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: createReadStream(file_path),
      ContentType: content_type,
    }))
  }

  public_url(key: string) {
    return `${this.public_base_url}/${key}`
  }
}
