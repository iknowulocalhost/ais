import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StudentsController } from './controllers/students.controller';
import { CreateStudentUseCase } from '../../application/use-cases/students/create-student.use-case';
import { UploadAvatarUseCase } from '../../application/use-cases/students/upload-avatar.use-case';
import { AuditService } from '../../application/services/audit.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.AVATAR_PROCESSING })],
  controllers: [StudentsController],
  providers: [CreateStudentUseCase, UploadAvatarUseCase, AuditService],
})
export class StudentsModule {}
