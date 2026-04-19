import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../entities/user/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'Niyerieth Ruiz', required: false })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiProperty({ enum: Role, example: Role.ADMIN, required: false })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
