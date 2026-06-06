import { ApiError } from '@/lib/api';

export interface FriendlyError {
  title: string;
  hint: string;
  detail?: string;
}

export function explainError(err: unknown): FriendlyError {
  if (err instanceof ApiError) {
    return explainHttpStatus(err.status, err.message);
  }

  if (err instanceof TypeError) {
    const msg = String(err.message ?? '');
    const propMatch =
      /reading ['"]([^'"]+)['"]/i.exec(msg) ||
      /of undefined \(reading ['"]([^'"]+)['"]\)/i.exec(msg);
    if (propMatch) {
      const prop = propMatch[1];
      return {
        title: 'Нет данных',
        hint: `Поле «${prop}» отсутствует в ответе сервера. Похоже, запись ещё не заполнена или удалена из базы.`,
        detail: msg,
      };
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return {
        title: 'Нет связи с сервером',
        hint: 'Не удалось связаться с backend. Проверьте, что сервер запущен и доступен по сети.',
        detail: msg,
      };
    }
    return {
      title: 'Ошибка в данных',
      hint: 'Один из объектов пришёл в неожиданном виде. Обновите страницу — если ошибка повторится, сообщите администратору.',
      detail: msg,
    };
  }

  if (err instanceof Error) {
    if (/fetch|network/i.test(err.message)) {
      return {
        title: 'Нет связи с сервером',
        hint: 'Проверьте подключение к сети и доступность backend.',
        detail: err.message,
      };
    }
    return {
      title: 'Что-то пошло не так',
      hint: 'Попробуйте обновить страницу или вернуться назад.',
      detail: err.message,
    };
  }

  return {
    title: 'Неизвестная ошибка',
    hint: 'Попробуйте обновить страницу.',
    detail: typeof err === 'string' ? err : undefined,
  };
}

function explainHttpStatus(status: number, message: string): FriendlyError {
  switch (status) {
    case 400:
      return {
        title: 'Некорректный запрос',
        hint: message || 'Проверьте заполненные поля.',
      };
    case 401:
      return {
        title: 'Сессия истекла',
        hint: 'Войдите заново.',
      };
    case 403:
      return {
        title: 'Недостаточно прав',
        hint: 'У вашей роли нет доступа к этой операции.',
      };
    case 404:
      return {
        title: 'Запись не найдена',
        hint: 'Возможно, её удалили или у вас устаревшая ссылка.',
      };
    case 409:
      return {
        title: 'Конфликт данных',
        hint: message || 'Запись в этом состоянии не допускает такую операцию.',
      };
    case 422:
      return {
        title: 'Данные не прошли валидацию',
        hint: message || 'Исправьте поля, отмеченные сервером.',
      };
    case 429:
      return {
        title: 'Слишком много запросов',
        hint: 'Подождите минуту и попробуйте снова.',
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        title: 'Сервер временно недоступен',
        hint: 'Ошибка на стороне backend. Попробуйте через минуту.',
        detail: `HTTP ${status}: ${message}`,
      };
    default:
      return {
        title: `Ошибка HTTP ${status}`,
        hint: message || 'Сервер вернул непредвиденный ответ.',
      };
  }
}
