import { Module } from '@nestjs/common';
import { SuperadminBootstrapService } from './superadmin-bootstrap.service';

@Module({
  providers: [SuperadminBootstrapService],
})
export class BootstrapModule {}
