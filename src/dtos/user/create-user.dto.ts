import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../entities/user/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Niyerieth Ruiz' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'niyerieth.ruiz@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  @IsEnum(Role)
  role: Role;
}
