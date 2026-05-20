import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../user/user.entity';
import { OperationType } from '../../events/operation-type.enum';
import { OperationStatus } from '../../events/operation-status.enum';

@Entity('notifications')
export class Notification {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ enum: OperationType })
  @Column({ type: 'enum', enum: OperationType })
  type!: OperationType;

  @ApiProperty({ enum: OperationStatus })
  @Column({ type: 'enum', enum: OperationStatus })
  status!: OperationStatus;

  @ApiProperty({ example: 100.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @ApiProperty({ example: 1, required: false })
  @Column({ nullable: true, name: 'from_account_id' })
  fromAccountId?: number;

  @ApiProperty({ example: 2, required: false })
  @Column({ nullable: true, name: 'to_account_id' })
  toAccountId?: number;

  @ApiProperty({ example: 'Depósito exitoso en tu cuenta' })
  @Column({ type: 'varchar', length: 500 })
  message!: string;

  @ApiProperty({ example: false })
  @Column({ default: false })
  read!: boolean;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ApiProperty({ example: 42, required: false })
  @Column({ nullable: true, name: 'transaction_id' })
  transactionId?: number;

  @ApiProperty({ type: Object, nullable: true, required: false })
  @Column({ type: 'json', nullable: true })
  payload?: Record<string, any>;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
