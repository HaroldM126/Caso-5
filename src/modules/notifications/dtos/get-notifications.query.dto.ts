import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OperationType } from '../../../events/operation-type.enum';
import { OperationStatus } from '../../../events/operation-status.enum';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Tipo de notificación', enum: OperationType })
  @IsOptional()
  @IsEnum(OperationType)
  type?: OperationType;

  @ApiPropertyOptional({ description: 'Estado de notificación', enum: OperationStatus })
  @IsOptional()
  @IsEnum(OperationStatus)
  status?: OperationStatus;

  @ApiPropertyOptional({ description: 'Filtrar notificaciones leídas o no leídas' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  read?: boolean;

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Registros por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
