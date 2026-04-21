import { ApiProperty } from '@nestjs/swagger';

export class AccountSaldoDto {
  @ApiProperty({
    example: 150.75,
    description: 'Saldo actual de la cuenta',
    type: Number,
  })
  saldo: number;
}