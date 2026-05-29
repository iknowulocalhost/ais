export interface MaxLinkToken {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt: Date | null;
}

export abstract class MaxLinkTokenRepository {
  abstract create(token: MaxLinkToken): Promise<void>;
  abstract findByToken(token: string): Promise<MaxLinkToken | null>;
  abstract markUsed(token: string): Promise<void>;
  abstract deleteExpiredForUser(userId: string): Promise<number>;
}

export const MAX_LINK_TOKEN_REPOSITORY = Symbol('MAX_LINK_TOKEN_REPOSITORY');
