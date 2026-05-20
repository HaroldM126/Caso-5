import { ApiProperty } from '@nestjs/swagger';
import { OperationType } from '../../../events/operation-type.enum';
import { OperationStatus } from '../../../events/operation-status.enum';

export class NotificationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ enum: OperationType })
  type: OperationType;

  @ApiProperty({ enum: OperationStatus })
  status: OperationStatus;

  @ApiProperty({ example: 100.5 })
  amount: number;

  @ApiProperty({ example: 1, required: false })
  fromAccountId?: number;

  @ApiProperty({ example: 2, required: false })
  toAccountId?: number;

  @ApiProperty({ example: 'Tu transferencia fue exitosa' })
  message: string;

  @ApiProperty({ example: false })
  read: boolean;

  @ApiProperty({ example: 42, required: false })
  transactionId?: number;

  @ApiProperty({ type: Object, required: false, nullable: true })
  payload?: Record<string, any>;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
