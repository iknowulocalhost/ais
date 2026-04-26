import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM шифрование персональных данных абитуриентов.
 *
 * Формат шифротекста: [iv(12)] || [authTag(16)] || [ciphertext(N)].
 * Ключ — 32 байта (hex/base64) из APPLICANTS_ENC_KEY.
 *
 * 152-ФЗ: ПДн (паспорт, СНИЛС, фото и т.д.) хранятся только в зашифрованном виде.
 * Ключ — в окружении/секрет-сторе, не в БД, не в коде.
 */
@Injectable()
export class ApplicantCipherService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit(): void {
    const raw = this.cfg.get<string>('APPLICANTS_ENC_KEY');
    if (!raw) {
      throw new Error(
        'APPLICANTS_ENC_KEY не задан. Сгенерируйте 32 байта (hex или base64) и добавьте в .env.',
      );
    }
    const buf = this.parseKey(raw);
    if (buf.length !== 32) {
      throw new Error(
        `APPLICANTS_ENC_KEY должен быть 32 байта (256 бит), получено ${buf.length}.`,
      );
    }
    this.key = buf;
  }

  encrypt(plaintext: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
  }

  decrypt(blob: Buffer): string {
    if (blob.length < 12 + 16) {
      throw new Error('Повреждённый шифроблок: меньше минимальной длины.');
    }
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const enc = blob.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  private parseKey(raw: string): Buffer {
    const trimmed = raw.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
    return Buffer.from(trimmed, 'base64');
  }
}
