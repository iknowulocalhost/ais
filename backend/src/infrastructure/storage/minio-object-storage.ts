import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';
import {
  BUCKETS,
  ObjectStorage,
  PutObjectInput,
} from '../../domain/services/object-storage';

@Injectable()
export class MinioObjectStorage implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(MinioObjectStorage.name);
  private readonly client: Client;

  constructor(cfg: ConfigService) {
    this.client = new Client({
      endPoint: cfg.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(cfg.get('MINIO_PORT', 9000)),
      useSSL: cfg.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: cfg.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: cfg.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
  }

  async onModuleInit(): Promise<void> {
    for (const bucket of Object.values(BUCKETS)) {
      await this.ensureBucket(bucket);
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1');
      this.logger.log(`Создан бакет MinIO: ${bucket}`);
    }
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.putObject(
      input.bucket,
      input.key,
      input.body as Buffer | Readable,
      input.size,
      {
        'Content-Type': input.contentType,
        ...(input.metadata ?? {}),
      },
    );
  }

  getPresignedGetUrl(
    bucket: string,
    key: string,
    ttlSeconds = 3600,
    inline = true,
  ): Promise<string> {
    // По умолчанию форсим inline-отдачу: квитанции и фото нужно открывать в
    // соседней вкладке, а не скачивать как файл. Если когда-нибудь понадобится
    // именно download — передайте inline=false.
    if (inline) {
      return this.client.presignedGetObject(bucket, key, ttlSeconds, {
        'response-content-disposition': 'inline',
      });
    }
    return this.client.presignedGetObject(bucket, key, ttlSeconds);
  }

  getPresignedPutUrl(
    bucket: string,
    key: string,
    ttlSeconds = 3600,
  ): Promise<string> {
    return this.client.presignedPutObject(bucket, key, ttlSeconds);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
