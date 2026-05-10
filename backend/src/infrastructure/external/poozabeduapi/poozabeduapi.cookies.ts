/**
 * Минимальная in-process «банка» для cookie сессии Сетевого города.
 * Полноценный tough-cookie не нужен — нам важны только имя=значение
 * на запросах в один и тот же origin, и без хранения между перезапусками.
 */
export class CookieJar {
  private readonly jar = new Map<string, string>();

  /** Принимает массив `Set-Cookie` из ответа (Node 20+: `headers.getSetCookie()`). */
  ingest(setCookies: string[]): void {
    for (const sc of setCookies) {
      const eq = sc.indexOf('=');
      if (eq < 0) continue;
      const semi = sc.indexOf(';');
      const name = sc.slice(0, eq).trim();
      const value = sc.slice(eq + 1, semi < 0 ? sc.length : semi).trim();
      if (!name) continue;
      this.jar.set(name, value);
    }
  }

  /** Сериализованная строка для заголовка `Cookie:`. */
  header(): string {
    return [...this.jar].map(([n, v]) => `${n}=${v}`).join('; ');
  }

  clear(): void {
    this.jar.clear();
  }

  size(): number {
    return this.jar.size;
  }
}
