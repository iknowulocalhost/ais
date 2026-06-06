import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { CreateUserUseCase } from '../../application/use-cases/users/create-user.use-case';
import { SetUserNetschoolEmployeeUseCase } from '../../application/use-cases/users/set-netschool-employee.use-case';
import { SetUserRolesUseCase } from '../../application/use-cases/users/set-user-roles.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/users/reset-password.use-case';
import { EnsureStudentAccountUseCase } from '../../application/use-cases/users/ensure-student-account.use-case';
import { BulkEnsureGroupAccountsUseCase } from '../../application/use-cases/users/bulk-ensure-group-accounts.use-case';
import { SetUserStudentExternalIdUseCase } from '../../application/use-cases/users/set-student-external-id.use-case';
import { PasswordGenerator } from '../../application/services/password-generator';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    SetUserNetschoolEmployeeUseCase,
    SetUserRolesUseCase,
    ResetPasswordUseCase,
    EnsureStudentAccountUseCase,
    BulkEnsureGroupAccountsUseCase,
    SetUserStudentExternalIdUseCase,
    PasswordGenerator,
    AuditService,
  ],
  exports: [AuditService],
})
export class UsersModule {}
