import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Account } from '../account/account.entity';
import { Notification } from '../notification/notification.entity';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column()
  password_hash: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => Account, (account) => account.user)
  account: Account;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
