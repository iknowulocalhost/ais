import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateApplicantUseCase } from '../../../application/use-cases/admissions/create-applicant.use-case';
import {
  APPLICANT_REPOSITORY,
  ApplicantRepository,
} from '../../../domain/repositories/applicant.repository';
import {
  Applicant,
  ApplicantPayload,
} from '../../../domain/entities/applicant.entity';
import {
  CreateApplicantDto,
  ListApplicantsQueryDto,
} from '../dto/create-applicant.dto';

@Controller('admissions')
export class AdmissionsController {
  constructor(
    private readonly createUc: CreateApplicantUseCase,
    @Inject(APPLICANT_REPOSITORY) private readonly repo: ApplicantRepository,
  ) {}

  @Roles(Role.COM)
  @Post()
  async create(@Body() dto: CreateApplicantDto, @CurrentUser() user: AuthenticatedUser | null) {
    if (!user) throw new ForbiddenException();
    const saved = await this.createUc.execute({
      payload: this.normalize(dto),
      status: dto.status ?? 'SUBMITTED',
      createdById: user.id,
    });
    return { id: saved.id, status: saved.status, createdAt: saved.createdAt };
  }

  @Roles(Role.COM)
  @Get()
  async list(@Query() q: ListApplicantsQueryDto) {
    const res = await this.repo.list(
      { status: q.status },
      q.limit ?? 50,
      q.offset ?? 0,
    );
    return {
      total: res.total,
      items: res.items.map((a) => this.summary(a)),
    };
  }

  @Roles(Role.COM)
  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const a = await this.repo.findById(id);
    if (!a) throw new NotFoundException();
    return this.full(a);
  }

  /** В списке отдаём только нечувствительный минимум: ФИО + статус + метаданные. */
  private summary(a: Applicant) {
    return {
      id: a.id,
      status: a.status,
      lastName: a.payload.lastName,
      firstName: a.payload.firstName,
      middleName: a.payload.middleName,
      createdById: a.createdById,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private full(a: Applicant) {
    return {
      id: a.id,
      status: a.status,
      payload: a.payload,
      createdById: a.createdById,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  /** Заполняет недостающие вложенные структуры значениями по умолчанию. */
  private normalize(dto: CreateApplicantDto): ApplicantPayload {
    return {
      photo: dto.photo ?? null,
      lastName: dto.lastName,
      firstName: dto.firstName,
      middleName: dto.middleName ?? null,
      birthDate: dto.birthDate,
      birthPlace: dto.birthPlace,
      gender: dto.gender,
      inn: dto.inn ?? null,
      snils: dto.snils,
      registrationNumber: dto.registrationNumber ?? null,
      caseNumber: dto.caseNumber ?? null,

      passport: {
        series: dto.passport.series,
        number: dto.passport.number,
        issuedBy: dto.passport.issuedBy,
        issuedDate: dto.passport.issuedDate,
        divisionCode: dto.passport.divisionCode,
        citizenship: dto.passport.citizenship ?? 'РФ',
        registrationAddress: dto.passport.registrationAddress ?? '',
      },

      residence: {
        phone: dto.residence?.phone ?? '',
        address: dto.residence?.address ?? '',
      },

      parents: (dto.parents ?? []).map((p) => ({
        kind: p.kind,
        lastName: p.lastName ?? '',
        firstName: p.firstName ?? '',
        middleName: p.middleName ?? '',
        address: p.address ?? '',
        work: p.work ?? '',
        phone: p.phone ?? '',
      })),

      representative: dto.representative
        ? {
            source: dto.representative.source,
            lastName: dto.representative.lastName ?? '',
            firstName: dto.representative.firstName ?? '',
            middleName: dto.representative.middleName ?? '',
            birthDate: dto.representative.birthDate ?? '',
            address: dto.representative.address ?? '',
            passport: {
              series: dto.representative.passport?.series ?? '',
              number: dto.representative.passport?.number ?? '',
              issuedBy: dto.representative.passport?.issuedBy ?? '',
              issuedDate: dto.representative.passport?.issuedDate ?? '',
            },
          }
        : null,

      education: (dto.education ?? []).map((e) => ({
        institution: e.institution ?? '',
        graduationYear: e.graduationYear ?? null,
        averageGrade: e.averageGrade ?? null,
        documentType: e.documentType ?? '',
        documentSeries: e.documentSeries ?? '',
        documentNumber: e.documentNumber ?? '',
        documentIssueDate: e.documentIssueDate ?? '',
        institutionType: e.institutionType ?? '',
      })),

      questionnaire: dto.questionnaire
        ? {
            medal: dto.questionnaire.medal ?? '',
            olympicChampion: dto.questionnaire.olympicChampion ?? '',
            workYears: dto.questionnaire.workYears ?? 0,
            workMonths: dto.questionnaire.workMonths ?? 0,
            specialtyYears: dto.questionnaire.specialtyYears ?? 0,
            specialtyMonths: dto.questionnaire.specialtyMonths ?? 0,
            foreignLanguages: dto.questionnaire.foreignLanguages ?? '',
            spoLevel: dto.questionnaire.spoLevel ?? '',
          }
        : null,

      additional: dto.additional
        ? {
            receiptNumber: dto.additional.receiptNumber ?? '',
            paidAmount: dto.additional.paidAmount ?? 0,
            paidMonths: dto.additional.paidMonths ?? 0,
            bank: dto.additional.bank ?? '',
            accountNumber: dto.additional.accountNumber ?? '',
            needsDormitory: dto.additional.needsDormitory ?? false,
            educationForm: dto.additional.educationForm ?? '',
            benefits: dto.additional.benefits ?? '',
            specialty: dto.additional.specialty ?? '',
            note: dto.additional.note ?? '',
          }
        : null,

      military: dto.military
        ? {
            status: dto.military.status ?? '',
            category: dto.military.category ?? '',
            rank: dto.military.rank ?? '',
            commissariat: dto.military.commissariat ?? '',
          }
        : null,
    };
  }
}
