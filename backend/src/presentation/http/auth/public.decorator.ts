import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Помечает эндпоинт как открытый (без JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
