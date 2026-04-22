import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransferService } from './transfer.service';
import { TransferDto } from '../../dtos/transfer/transfer.dto';
import { DepositDto } from '../../dtos/transfer/deposit.dto';
import { WithdrawDto } from '../../dtos/transfer/withdraw.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../entities/user/user.entity';

@Controller('transfer')
@UseGuards(JwtAuthGuard) // Solo autorizados por defecto
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  async transfer(@Request() req: any, @Body() transferDto: TransferDto) {
    // req.user viene del jwt-auth.guard (jwt.strategy.ts validate() return)
    const fromId = req.user.id;
    return this.transferService.transfer(fromId, transferDto.toAccountId, transferDto.amount);
  }

  // Depósito: SOLO ADMIN
  @Post('deposit')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async deposit(@Body() depositDto: DepositDto) {
    return this.transferService.deposit(depositDto.toAccountId, depositDto.amount);
  }

  // Retiro: SOLO USUARIO (solo puede retirar de su propia cuenta)
  @Post('withdraw')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  async withdraw(@Request() req: any, @Body() withdrawDto: WithdrawDto) {
    const userId = req.user.id;
    return this.transferService.withdraw(userId, withdrawDto.amount);
  }
}
