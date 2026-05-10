import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const petrovich = require('petrovich') as PetrovichApi;

/**
 * Тонкий типизированный шим над npm `petrovich`. Пакет — чистый JS без типов,
 * поэтому объявляем форму API локально, чтобы остальной код не возился с `any`.
 */
type Gender = 'male' | 'female' | 'androgynous';
type Case =
  | 'nominative' | 'genitive' | 'dative'
  | 'accusative' | 'instrumental' | 'prepositional';

interface PersonInput {
  first?: string;
  middle?: string;
  last?: string;
  gender?: Gender;
}

interface PetrovichApi {
  (person: PersonInput, gcase: Case): PersonInput & { gender: Gender };
  detect_gender(middle: string): Gender;
}

/**
 * Сервис склонения ФИО. Используем для авто-генерации `fullNameDat` при подаче справки;
 * оператор всегда может скорректировать вручную (petrovich даёт ~95% точности).
 */
@Injectable()
export class DativeNameService {
  private readonly logger = new Logger(DativeNameService.name);

  /**
   * 'Иванов Иван Иванович' → 'Иванову Ивану Ивановичу'.
   * Для редких / нерусских фамилий может сработать неточно — в таких случаях
   * возвращаем nominative (исходную строку), чтобы оператор увидел что-то
   * вменяемое и поправил руками.
   */
  toDative(fullName: string): string {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const [last, first, middle] = parts;

    try {
      const gender = middle ? petrovich.detect_gender(middle) : 'androgynous';
      const result = petrovich(
        { last, first, middle, gender },
        'dative',
      );
      return [result.last, result.first, result.middle].filter(Boolean).join(' ');
    } catch (err) {
      this.logger.warn(
        `petrovich не справился с «${fullName}»: ${(err as Error).message}. Возвращаем nominative.`,
      );
      return fullName;
    }
  }
}
