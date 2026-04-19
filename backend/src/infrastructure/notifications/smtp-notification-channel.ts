import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  NotificationChannel,
  NotificationMessage,
} from '../../domain/services/notification-channel';

/**
 * Отправка через SMTP. Если SMTP_HOST не задан — работаем как console-канал
 * (пишем в лог, возвращаем true). Это удобно в dev и CI: никакой внешней
 * зависимости, поведение предсказуемо.
 *
 * Для prod-окружения выставить SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
 * / SMTP_FROM. Конфиг верифицируется при старте (verify()).
 */
@Injectable()
export class SmtpNotificationChannel
  extends NotificationChannel
  implements OnModuleInit
{
  private readonly logger = new Logger(SmtpNotificationChannel.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly cfg: ConfigService) {
    super();
    this.from = cfg.get<string>('SMTP_FROM', 'noreply@ais-students.local');
  }

  async onModuleInit(): Promise<void> {
    const host = this.cfg.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST не задан — уведомления будут логироваться в консоль (dev-режим).',
      );
      return;
    }
    const port = Number(this.cfg.get<number>('SMTP_PORT', 587));
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: this.cfg.get<string>('SMTP_USER')
        ? {
            user: this.cfg.get<string>('SMTP_USER'),
            pass: this.cfg.get<string>('SMTP_PASSWORD', ''),
          }
        : undefined,
    });
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP-канал готов: ${host}:${port}`);
    } catch (err) {
      this.logger.error(
        `SMTP verify() упал: ${(err as Error).message}. Переключаемся на console.`,
      );
      this.transporter = null;
    }
  }

  async send(msg: NotificationMessage): Promise<boolean> {
    if (!this.transporter) {
      // console-fallback
      this.logger.log(
        `[notify → ${msg.to}] ${msg.subject}\n${msg.text}`,
      );
      return true;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Отправка на ${msg.to} не удалась: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
