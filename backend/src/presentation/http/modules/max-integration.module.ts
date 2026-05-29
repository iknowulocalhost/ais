import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaxIntegrationController } from '../controllers/max-integration.controller';
import { MaxLinkTokenOrmEntity } from '../../../infrastructure/database/entities/max-link-token.orm-entity';
import { UserOrmEntity } from '../../../infrastructure/database/entities/user.orm-entity';
import { TypeOrmMaxLinkTokenRepository } from '../../../infrastructure/database/repositories/max-link-token.repository.impl';
import { MAX_LINK_TOKEN_REPOSITORY } from '../../../domain/repositories/max-link-token.repository';
import { CreateMaxLinkTokenUseCase } from '../../../application/use-cases/max/create-max-link-token.use-case';
import { LinkMaxAccountUseCase } from '../../../application/use-cases/max/link-max-account.use-case';
import { UnlinkMaxAccountUseCase } from '../../../application/use-cases/max/unlink-max-account.use-case';
import { BotSharedSecretGuard } from '../auth/bot-shared-secret.guard';
import { AuditService } from '../../../application/services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaxLinkTokenOrmEntity, UserOrmEntity])],
  controllers: [MaxIntegrationController],
  providers: [
    { provide: MAX_LINK_TOKEN_REPOSITORY, useClass: TypeOrmMaxLinkTokenRepository },
    CreateMaxLinkTokenUseCase,
    LinkMaxAccountUseCase,
    UnlinkMaxAccountUseCase,
    BotSharedSecretGuard,
    AuditService,
  ],
})
export class MaxIntegrationModule {}
