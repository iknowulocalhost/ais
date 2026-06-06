import 'reflect-metadata';
import * as dns from 'dns';
import { NestFactory } from '@nestjs/core';

// AAAA для poo.zabedu.ru/chtotib.ru у провайдера колледжа отдаёт 100::1 (discard).
// Принудительно IPv4: dns.lookup + undici (fetch) connect.
dns.setDefaultResultOrder('ipv4first');
// undici поставляется встроенно в Node ≥18, types не объявлены — require обходит TS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Agent, setGlobalDispatcher } = require('undici');
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { mountBullBoard } from './infrastructure/queue/bull-board.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  // Лимит тела бампнут до 8 МБ — фото абитуриента (data URL JPEG) проходит впритык по дефолту 100kb.
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Bull Board admin UI: /api/admin/queues (только SUPERADMIN/ADM).
  mountBullBoard(app);

  const port = Number(process.env.APP_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`АИС:Студенты backend запущен на :${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err);
  process.exit(1);
});
