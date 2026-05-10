import { createHash } from 'crypto';

/**
 * Чистые функции аутентификации «Сетевого ПОО» (IRTech).
 * Покрывается юнит-тестами без сети.
 *
 * Протокол:
 *   POST /services/security/login
 *   {
 *     "login":      "<логин>",
 *     "password":   base64(sha256(plainPassword)),
 *     "isRemember": false
 *   }
 *
 * Сервер ставит HttpOnly cookie сессии и возвращает 200 с пустым телом.
 * Никакого challenge/salt, никакого CSRF-токена. Подсмотрено в их же
 * `js/security.js`: `Hashes.SHA256().b64(password)` (jshashes).
 */

/**
 * Хэширует пароль так, как ожидает фронтенд Сетевого ПОО.
 *
 *   plainPassword='admin' → 'jGl25bVBBBW96Qi9Te4V37Fnqchz/Eu4qB9vKrRIqRg='
 */
export function buildLoginPasswordHash(plainPassword: string): string {
  return createHash('sha256').update(plainPassword, 'utf8').digest('base64');
}
