import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';

/**
 * Генератор временных паролей для свежесозданных студенческих аккаунтов.
 * 12 символов, гарантированно по одной букве в верхнем/нижнем регистре,
 * по цифре и спецсимволу — устойчиво к сокращённым корпоративным политикам.
 *
 * Криптографически устойчив (используется `crypto.randomInt`), поэтому годится
 * для одноразовой выдачи; рассчитан на немедленную смену пользователем.
 */
@Injectable()
export class PasswordGenerator {
  private static readonly UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // без I/O — путаются с 1/0
  private static readonly LOWER = 'abcdefghijkmnpqrstuvwxyz';   // без l — тоже путается
  private static readonly DIGITS = '23456789';                  // без 0/1
  private static readonly SPECIAL = '!@#$%&*+-=?';

  generate(length = 12): string {
    const all = PasswordGenerator.UPPER + PasswordGenerator.LOWER + PasswordGenerator.DIGITS + PasswordGenerator.SPECIAL;
    // Гарантия по одному символу из каждой группы — это защищает от случайного
    // отказа сторонних валидаторов «нет цифры», «нет спецсимвола».
    const required = [
      pick(PasswordGenerator.UPPER),
      pick(PasswordGenerator.LOWER),
      pick(PasswordGenerator.DIGITS),
      pick(PasswordGenerator.SPECIAL),
    ];
    const rest: string[] = [];
    for (let i = required.length; i < length; i++) rest.push(pick(all));
    return shuffle([...required, ...rest]).join('');
  }
}

function pick(alphabet: string): string {
  return alphabet[randomInt(0, alphabet.length)];
}

function shuffle<T>(arr: T[]): T[] {
  // Fisher-Yates на crypto.randomInt — для однократной выдачи этого с запасом.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
