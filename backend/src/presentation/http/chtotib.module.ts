import { Module } from '@nestjs/common';
import { ChtotibController } from './controllers/chtotib.controller';
import { ChtotibParserService } from '../../infrastructure/external/chtotib/chtotib-parser.service';
import { GetTodayScheduleUseCase } from '../../application/use-cases/chtotib/get-today-schedule.use-case';
import { GetWeekScheduleUseCase } from '../../application/use-cases/chtotib/get-week-schedule.use-case';

/**
 * Парсер публичных страниц chtotib.ru. Отдельный модуль от Сетевого ПОО:
 * у того другой жизненный цикл (sync через BullMQ, общая сессия), а здесь —
 * stateless парсинг с in-memory кешем.
 */
@Module({
  controllers: [ChtotibController],
  providers: [ChtotibParserService, GetTodayScheduleUseCase, GetWeekScheduleUseCase],
  exports: [ChtotibParserService],
})
export class ChtotibModule {}
