import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { CreateUserUseCase } from '../../application/use-cases/users/create-user.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [UsersController],
  providers: [CreateUserUseCase, AuditService],
  exports: [AuditService],
})
export class UsersModule {}
