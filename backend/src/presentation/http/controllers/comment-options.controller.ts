import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { ListCommentOptionsUseCase } from '../../../application/use-cases/comment-options/list-comment-options.use-case';
import { CreateCommentOptionUseCase } from '../../../application/use-cases/comment-options/create-comment-option.use-case';
import { DeleteCommentOptionUseCase } from '../../../application/use-cases/comment-options/delete-comment-option.use-case';
import { CreateCommentOptionDto } from '../dto/comment-option.dto';

@Controller('comment-options')
export class CommentOptionsController {
  constructor(
    private readonly listUc: ListCommentOptionsUseCase,
    private readonly createUc: CreateCommentOptionUseCase,
    private readonly deleteUc: DeleteCommentOptionUseCase,
  ) {}

  /** Доступно всем сотрудникам — справочник используется при работе с заявками. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA)
  @Get()
  async list() {
    const items = await this.listUc.execute();
    return items.map((c) => ({
      id: c.id,
      title: c.title,
      text: c.text,
      isDefault: c.isDefault,
    }));
  }

  @Roles(Role.SUPERADMIN, Role.ADM)
  @Post()
  async create(@Body() dto: CreateCommentOptionDto) {
    const saved = await this.createUc.execute(dto);
    return { id: saved.id };
  }

  @Roles(Role.SUPERADMIN, Role.ADM)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteUc.execute(id);
    return { ok: true };
  }
}
