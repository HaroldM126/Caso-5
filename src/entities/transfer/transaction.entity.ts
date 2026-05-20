import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Account } from '../account/account.entity';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  TRANSFER = 'TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('transactions')
export class Transaction {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ enum: TransactionType })
  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ example: 100.5 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({ type: () => Account, nullable: true })
  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'from_account_id' })
  fromAccount?: Account;

  @ApiProperty({ type: () => Account, nullable: true })
  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'to_account_id' })
  toAccount?: Account;

  @ApiProperty({ enum: TransactionStatus })
  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
