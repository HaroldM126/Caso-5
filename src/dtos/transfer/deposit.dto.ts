import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class DepositDto {
  @IsNotEmpty()
  @IsInt()
  toAccountId: number;

  @IsNotEmpty()
  @IsPositive()
  amount: number;
}
