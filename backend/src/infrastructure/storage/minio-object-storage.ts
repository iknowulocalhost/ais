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
  /** Внутренний клиент: bucketExists / putObject / deleteObject через docker-сеть. */
  private readonly client: Client;
  /** Клиент для подписи URL, которые отдаём браузеру. По умолчанию = внутренний. */
  private readonly publicClient: Client;

  constructor(cfg: ConfigService) {
    this.client = new Client({
      endPoint: cfg.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(cfg.get('MINIO_PORT', 9000)),
      useSSL: cfg.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: cfg.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: cfg.getOrThrow<string>('MINIO_SECRET_KEY'),
    });

    // MINIO_PUBLIC_URL = https://minio.chtotib.ru (или https://ais.chtotib.ru/minio,
    // если minio проксируется под path). Если не задан — подпись делается тем же
    // внутренним клиентом, и presigned URL пойдёт на http://minio:9000 (mixed-content).
    const publicUrl = cfg.get<string>('MINIO_PUBLIC_URL', '').trim();
    if (publicUrl) {
      try {
        const u = new URL(publicUrl);
        this.publicClient = new Client({
          endPoint: u.hostname,
          port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
          useSSL: u.protocol === 'https:',
          accessKey: cfg.getOrThrow<string>('MINIO_ACCESS_KEY'),
          secretKey: cfg.getOrThrow<string>('MINIO_SECRET_KEY'),
          // Регион должен совпадать с тем, что у внутреннего клиента (us-east-1
          // при ensureBucket). Без явного region minio-js при подписи делает
          // GetBucketRegion-запрос на этот же endpoint — DNS-резолв падает,
          // если minio.chtotib.ru ещё не доступен из контейнера бэка.
          region: 'us-east-1',
        });
        this.logger.log(`MinIO presign endpoint: ${publicUrl}`);
      } catch (e) {
        this.logger.warn(`MINIO_PUBLIC_URL некорректен (${(e as Error).message}), использую внутренний.`);
        this.publicClient = this.client;
      }
    } else {
      this.publicClient = this.client;
    }
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
    if (inline) {
      return this.publicClient.presignedGetObject(bucket, key, ttlSeconds, {
        'response-content-disposition': 'inline',
      });
    }
    return this.publicClient.presignedGetObject(bucket, key, ttlSeconds);
  }

  getPresignedPutUrl(
    bucket: string,
    key: string,
    ttlSeconds = 3600,
  ): Promise<string> {
    return this.publicClient.presignedPutObject(bucket, key, ttlSeconds);
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
