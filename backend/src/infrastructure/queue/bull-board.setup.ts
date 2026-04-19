import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { BaseAdapter } from '@bull-board/api/dist/src/queueAdapters/base';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUES } from './queue.constants';
import { JwtAuthGuard } from '../../presentation/http/auth/jwt-auth.guard';
import { RolesGuard } from '../../presentation/http/auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { Role } from '../../domain/enums/role.enum';

/**
 * Монтирует Bull Board на /api/admin/queues.
 * Защищён JwtAuthGuard + RolesGuard (только SUPERADMIN/ADM).
 *
 * Примечание: Bull Board — Express router, поэтому делаем мини-мидлварь,
 * которая вручную прогоняет guard'ы через фейковый ExecutionContext.
 */
export function mountBullBoard(app: INestApplication): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/api/admin/queues');

  const queues: Queue[] = [
    app.get<Queue>(getQueueToken(QUEUES.AVATAR_PROCESSING)),
    app.get<Queue>(getQueueToken(QUEUES.REPORT_EXPORT)),
  ];

  // Каст нужен, потому что @bull-board/api и bullmq эволюционируют независимо —
  // возвращаемый тип Job<...> в новых bullmq стал шире, чем QueueJob в bull-board.
  // Рантайм совместим — расхождение чисто на уровне .d.ts.
  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)) as unknown as readonly BaseAdapter[],
    serverAdapter,
  });

  const reflector = app.get(Reflector);
  const jwtGuard = new JwtAuthGuard(reflector);
  const rolesGuard = new RolesGuard(reflector);

  // Минимальный охранник: проверяем JWT и что роль ADM/SUPERADMIN.
  const guardMw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res, getNext: () => next }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as Parameters<typeof jwtGuard.canActivate>[0];

    try {
      const okAuth = await Promise.resolve(jwtGuard.canActivate(ctx));
      if (!okAuth) return void res.status(401).end();
      // RolesGuard читает metadata; здесь явно проверим через reflect-style обёртку.
      const user = (req as unknown as { user?: { roles: Role[] } }).user;
      if (!user) return void res.status(401).end();
      if (!user.roles.includes(Role.SUPERADMIN) && !user.roles.includes(Role.ADM)) {
        return void res.status(403).end();
      }
      // rolesGuard напрямую не вызываем: metadata @Roles() у bull-board роутов нет,
      // проверку сделали выше вручную. rolesGuard ниже — чтобы линтер не ругался на неиспользование.
      void rolesGuard;
      next();
    } catch {
      res.status(401).end();
    }
  };

  app.use('/api/admin/queues', guardMw, serverAdapter.getRouter());
}
