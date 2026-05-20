import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkNotificationReadDto {
  @ApiPropertyOptional({ example: true, description: 'Marca la notificación como leída/ no leída' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  read?: boolean = true;
}
