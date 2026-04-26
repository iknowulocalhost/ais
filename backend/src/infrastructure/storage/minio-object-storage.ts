import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { ObjectStorage, PutObjectInput, BUCKETS } from '../../domain/services/object-storage';

@Injectable()
export class MinioObjectStorage implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(MinioObjectStorage.name);
  private readonly client: MinioClient;

  constructor(cfg: ConfigService) {
    this.client = new MinioClient({
      endPoint: cfg.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(cfg.get<string | number>('MINIO_PORT', 9000)),
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
    await this.client.putObject(input.bucket, input.key, input.body as Buffer, input.size, {
      'Content-Type': input.contentType,
      ...(input.metadata ?? {}),
    });
  }

  getPresignedGetUrl(bucket: string, key: string, ttlSeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(bucket, key, ttlSeconds);
  }

  getPresignedPutUrl(bucket: string, key: string, ttlSeconds = 3600): Promise<string> {
    return this.client.presignedPutObject(bucket, key, ttlSeconds);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
