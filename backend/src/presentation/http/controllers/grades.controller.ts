import {
  Body,
  Controller,
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
import { CreateGradeSheetUseCase } from '../../../application/use-cases/grades/create-grade-sheet.use-case';
import { SubmitGradesUseCase } from '../../../application/use-cases/grades/submit-grades.use-case';
import { CloseGradeSheetUseCase } from '../../../application/use-cases/grades/close-grade-sheet.use-case';
import {
  GRADE_SHEET_REPOSITORY,
  GradeSheetRepository,
} from '../../../domain/repositories/grade-sheet.repository';
import {
  GRADE_REPOSITORY,
  GradeRepository,
} from '../../../domain/repositories/grade.repository';
import {
  CreateGradeSheetDto,
  ListGradeSheetsQueryDto,
  SubmitGradesDto,
} from '../dto/grade.dto';

@Controller('grades')
export class GradesController {
  constructor(
    private readonly createSheetUC: CreateGradeSheetUseCase,
    private readonly submitGradesUC: SubmitGradesUseCase,
    private readonly closeSheetUC: CloseGradeSheetUseCase,
    @Inject(GRADE_SHEET_REPOSITORY) private readonly sheets: GradeSheetRepository,
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
  ) {}

  // ── Sheets ──────────────────────────────────────────────

  @Roles(Role.ADM, Role.TEA)
  @Post('sheets')
  createSheet(@Body() dto: CreateGradeSheetDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.createSheetUC.execute({ ...dto, teacherId: actor.id });
  }

  @Roles(Role.ADM, Role.TEA, Role.ANA)
  @Get('sheets')
  listSheets(
    @Query() q: ListGradeSheetsQueryDto,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.sheets.list(
      { groupId: q.groupId, teacherId: q.teacherId, status: q.status },
      Number(limit),
      Number(offset),
    );
  }

  @Roles(Role.ADM, Role.TEA, Role.ANA)
  @Get('sheets/:id')
  async oneSheet(@Param('id', new ParseUUIDPipe()) id: string) {
    const s = await this.sheets.findById(id);
    if (!s) throw new NotFoundException();
    return s;
  }

  @Roles(Role.ADM, Role.TEA, Role.ANA, Role.STU)
  @Get('sheets/:id/grades')
  async sheetGrades(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.grades.findBySheetId(id);
  }

  // ── Submit grades ─────────────────────────────────────

  @Roles(Role.TEA)
  @Post('sheets/:id/submit')
  submitGrades(
    @Param('id', new ParseUUIDPipe()) sheetId: string,
    @Body() dto: SubmitGradesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.submitGradesUC.execute({ sheetId, grades: dto.grades }, actor.id);
  }

  // ── Close sheet ───────────────────────────────────────

  @Roles(Role.ADM, Role.TEA)
  @Post('sheets/:id/close')
  closeSheet(
    @Param('id', new ParseUUIDPipe()) sheetId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const isAdmin = actor.roles.includes(Role.ADM) || actor.roles.includes(Role.SUPERADMIN);
    return this.closeSheetUC.execute(sheetId, actor.id, isAdmin);
  }

  // ── Student transcript ────────────────────────────────

  @Roles(Role.ADM, Role.TEA, Role.ANA, Role.STU)
  @Get('students/:studentId')
  async studentGrades(@Param('studentId', new ParseUUIDPipe()) studentId: string) {
    return this.grades.findByStudentId(studentId);
  }
}
