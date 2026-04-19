import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransferService } from './transfer.service';
import { TransferDto } from '../../dtos/transfer/transfer.dto';

@Controller('transfer')
@UseGuards(JwtAuthGuard) // Solo autorizados
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  async transfer(@Request() req: any, @Body() transferDto: TransferDto) {
    // req.user viene del jwt-auth.guard (jwt.strategy.ts validate() return)
    const fromId = req.user.id;
    return this.transferService.transfer(fromId, transferDto.toAccountId, transferDto.amount);
  }
}
