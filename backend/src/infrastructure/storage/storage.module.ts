import { Global, Module } from '@nestjs/common';
import { MinioObjectStorage } from './minio-object-storage';
import { OBJECT_STORAGE } from '../../domain/services/object-storage';

@Global()
@Module({
  providers: [
    MinioObjectStorage,
    { provide: OBJECT_STORAGE, useExisting: MinioObjectStorage },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
