import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';
import { AvatarProcessor } from './processors/avatar.processor';
import { ReportExportProcessor } from './processors/report-export.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.AVATAR_PROCESSING },
      { name: QUEUES.REPORT_EXPORT },
      { name: QUEUES.NOTIFICATIONS },
    ),
  ],
  providers: [AvatarProcessor, ReportExportProcessor],
  exports: [BullModule],
})
export class QueueModule {}
