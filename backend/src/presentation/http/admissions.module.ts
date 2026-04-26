import { Module } from '@nestjs/common';
import { AdmissionsController } from './controllers/admissions.controller';
import { CreateApplicantUseCase } from '../../application/use-cases/admissions/create-applicant.use-case';

@Module({
  controllers: [AdmissionsController],
  providers: [CreateApplicantUseCase],
})
export class AdmissionsModule {}
