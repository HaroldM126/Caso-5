import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferDto {
  @IsNotEmpty()
  @IsInt()
  toAccountId: number;

  @IsNotEmpty()
  @IsPositive()
  @Type(() => Number)
  amount: number;
}
