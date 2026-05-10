/**
 * Порт S3-совместимого файлового хранилища (MinIO).
 * Реализация — infrastructure/storage.
 */
export interface PutObjectInput {
  bucket: string;
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType: string;
  size?: number;
  metadata?: Record<string, string>;
}

export abstract class ObjectStorage {
  abstract putObject(input: PutObjectInput): Promise<void>;
  abstract getPresignedGetUrl(bucket: string, key: string, ttlSeconds?: number, inline?: boolean): Promise<string>;
  abstract getPresignedPutUrl(bucket: string, key: string, ttlSeconds?: number): Promise<string>;
  abstract deleteObject(bucket: string, key: string): Promise<void>;
  abstract ensureBucket(bucket: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** Стандартные бакеты. */
export const BUCKETS = {
  AVATARS: 'avatars',
  DOCUMENTS: 'documents',
  /** Квитанции по заявкам на пропуск. Изолированы от студенческих доков. */
  PASSES: 'passes',
} as const;
