import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** One-time токен MAX-привязки. TTL 10 мин (проверяется в use-case'ах). */
@Entity({ name: 'max_link_tokens' })
export class MaxLinkTokenOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  token!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
