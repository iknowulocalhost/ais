import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'max_outbox' })
@Index(['deliveredAt'])
export class MaxOutboxOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'max_chat_id', type: 'varchar', length: 64 })
  maxChatId!: string;

  @Column({ name: 'text', type: 'text' })
  text!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;
}
