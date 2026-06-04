export interface MaxOutboxItem {
  id: string;
  userId: string | null;
  maxChatId: string;
  text: string;
  createdAt: Date;
}

export abstract class MaxOutboxRepository {
  /** Положить сообщение в очередь, вернуть id. */
  abstract enqueue(input: { userId: string | null; maxChatId: string; text: string }): Promise<string>;
  /** Забрать недоставленные сообщения с id > afterId, не более limit штук. */
  abstract fetchPending(afterId: string, limit: number): Promise<MaxOutboxItem[]>;
  /** Пометить сообщения доставленными. */
  abstract markDelivered(ids: string[]): Promise<number>;
  /** Удалить доставленные старше N дней — housekeeping. */
  abstract purgeOlderThan(days: number): Promise<number>;
}

export const MAX_OUTBOX_REPOSITORY = Symbol('MAX_OUTBOX_REPOSITORY');
