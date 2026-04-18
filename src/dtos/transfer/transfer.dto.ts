import { IsInt, IsNotEmpty, IsPositive, Min } from 'class-validator';

export class TransferDto {
  @IsNotEmpty()
  @IsInt()
  toAccountId: number;

  @IsNotEmpty()
  @IsPositive()
  amount: number;
}
