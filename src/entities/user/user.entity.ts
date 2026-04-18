import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column( { length: 100 })
  nombre: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column()
  password_hash: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldo: number;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;
}
