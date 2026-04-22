import { IsNotEmpty, IsPositive } from 'class-validator';

export class WithdrawDto {
  @IsNotEmpty()
  @IsPositive()
  amount: number;
}
