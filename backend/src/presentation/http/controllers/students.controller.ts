import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateStudentUseCase } from '../../../application/use-cases/students/create-student.use-case';
import { UploadAvatarUseCase } from '../../../application/use-cases/students/upload-avatar.use-case';
import { CreateStudentDto, ListStudentsQueryDto } from '../dto/create-student.dto';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';
import { AuditContext } from '../../../application/services/audit.service';

const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MiB

function ctx(req: Request, ip: string, actorId: string): AuditContext {
  return {
    actorId,
    ipAddress: ip ?? null,
    userAgent: (req.headers['user-agent'] as string) ?? null,
  };
}

@Controller('students')
export class StudentsController {
  constructor(
    private readonly createUC: CreateStudentUseCase,
    private readonly uploadAvatarUC: UploadAvatarUseCase,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Roles(Role.ADM, Role.COM)
  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.createUC.execute(dto, ctx(req, ip, actor.id));
  }

  @Roles(Role.ADM, Role.TEA, Role.ANA, Role.COM)
  @Get()
  async list(@Query() q: ListStudentsQueryDto, @Query('limit') limit = '50', @Query('offset') offset = '0') {
    return this.students.list(
      { status: q.status, groupId: q.groupId, search: q.search },
      Number(limit),
      Number(offset),
    );
  }

  @Roles(Role.ADM, Role.TEA, Role.COM, Role.STU, Role.ANA)
  @Get(':id')
  async one(@Param('id', new ParseUUIDPipe()) id: string) {
    const s = await this.students.findById(id);
    if (!s) throw new NotFoundException();
    return s;
  }

  @Roles(Role.ADM, Role.TEA, Role.STU)
  @Get(':id/avatar-url')
  async avatarUrl(@Param('id', new ParseUUIDPipe()) id: string) {
    const s = await this.students.findById(id);
    if (!s || !s.avatarObjectKey) throw new NotFoundException('Аватар не загружен');
    const url = await this.storage.getPresignedGetUrl(BUCKETS.AVATARS, s.avatarObjectKey, 900);
    return { url, ttlSeconds: 900 };
  }

  @Roles(Role.ADM, Role.PHO, Role.STU)
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }))
  async uploadAvatar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Файл обязателен (form-data поле "file")');
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      throw new BadRequestException('Допустимые форматы: PNG, JPEG, WebP');
    }
    return this.uploadAvatarUC.execute(
      { studentId: id, body: file.buffer, contentType: file.mimetype, size: file.size },
      ctx(req, ip, actor.id),
    );
  }
}
