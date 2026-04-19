import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CreatePaymentUseCase } from '../../../application/use-cases/payments/create-payment.use-case';
import { MarkPaymentPaidUseCase } from '../../../application/use-cases/payments/mark-payment-paid.use-case';
import { CreatePaymentDto, ListPaymentsQueryDto, MarkPaidDto } from '../dto/payment.dto';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../../domain/repositories/payment.repository';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly createUC: CreatePaymentUseCase,
    private readonly markPaidUC: MarkPaymentPaidUseCase,
    @Inject(PAYMENT_REPOSITORY) private readonly repo: PaymentRepository,
  ) {}

  @Roles(Role.ACC, Role.ADM)
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.createUC.execute(dto);
  }

  @Roles(Role.ACC, Role.ADM, Role.ANA, Role.STU)
  @Get()
  async list(@Query() q: ListPaymentsQueryDto, @Query('limit') limit = '50', @Query('offset') offset = '0') {
    const res = await this.repo.list(
      {
        studentId: q.studentId,
        status: q.status,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
      },
      Number(limit),
      Number(offset),
    );
    // bigint → string, чтобы JSON.stringify не падал.
    return {
      ...res,
      items: res.items.map((p) => ({ ...p, amountKopecks: p.amountKopecks.toString() })),
    };
  }

  @Roles(Role.ACC, Role.ADM, Role.ANA)
  @Get('students/:studentId/balance')
  async balance(@Param('studentId', new ParseUUIDPipe()) studentId: string) {
    const sumPaid = await this.repo.sumPaidByStudent(studentId);
    return { studentId, paidKopecks: sumPaid.toString() };
  }

  @Roles(Role.ACC, Role.ADM)
  @Post(':id/mark-paid')
  @HttpCode(204)
  async markPaid(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: MarkPaidDto) {
    await this.markPaidUC.execute(id, dto.externalRef ?? null);
  }
}
