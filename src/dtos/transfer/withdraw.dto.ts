import { IsNotEmpty, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawDto {
  @IsNotEmpty()
  @IsPositive()
  @Type(() => Number)
  amount: number;
}
