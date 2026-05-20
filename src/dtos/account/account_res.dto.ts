import { ApiProperty } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador único de la cuenta',
  })
  id: number;

  @ApiProperty({
    example: 150.75,
    description: 'Saldo actual de la cuenta',
    type: Number,
  })
  saldo: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Fecha de creación de la cuenta',
    type: Date,
  })
  created_at: Date;
}
