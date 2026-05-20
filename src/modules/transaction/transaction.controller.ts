import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { FilterTransactionsDto } from '../../dtos/transaction/filter-transactions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../entities/user/user.entity';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('me')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary: 'Obtener historial de transacciones del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de transacciones obtenido correctamente.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async getMyTransactions(
    @Req() req: any,
    @Query() filters: FilterTransactionsDto,
  ) {
    const userId = req.user.id;
    return this.transactionService.getMyTransactions(userId, filters);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Obtener todas las transacciones del sistema (Solo ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de todas las transacciones obtenido correctamente.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido, requiere rol ADMIN.' })
  async getAllTransactions(@Query() filters: FilterTransactionsDto) {
    return this.transactionService.getAllTransactions(filters);
  }
}
