import {Controller, Get,Param,ParseIntPipe, Req, UseGuards} from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiParam,ApiResponse,ApiTags,} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccountsService }    from './accounts.service';
import { AccountResponseDto } from '../../dtos/account/account_res.dto';
import { AccountSaldoDto }  from '../../dtos/account/account_sal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../entities/user/user.entity';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}


@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  

  @Get('me')
  @ApiOperation({
    summary:     'Obtener mi cuenta',
    description: 'Retorna la cuenta asociada al usuario autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Cuenta del usuario autenticado', type: AccountResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado'                  })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada'            })
  getMyAccount(@Req() req: RequestWithUser): Promise<AccountResponseDto> {
    const userId = req.user['id'];
    return this.accountsService.findByUserId(userId);
  }

  @Get('me/saldo')
  @ApiOperation({
    summary:     'Consultar mi saldo',
    description: 'Retorna únicamente el saldo actual de la cuenta del usuario autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Saldo actual',        type: AccountSaldoDto })
  @ApiResponse({ status: 401, description: 'No autenticado'       })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  getMyBalance(@Req() req: RequestWithUser): Promise<AccountSaldoDto> {
    const userId = req.user['id'];
    return this.accountsService.getBalance(userId);
  }

  

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:     'Listar todas las cuentas',
    description: 'Retorna el listado completo de cuentas. Uso administrativo.',
  })
  @ApiResponse({ status: 200, description: 'Listado de cuentas', type: [AccountResponseDto] })
  @ApiResponse({ status: 401, description: 'No autenticado'      })
  findAll(): Promise<AccountResponseDto[]> {
    return this.accountsService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({
    summary:     'Obtener cuenta por ID de usuario',
    description: 'Retorna la cuenta asociada a un usuario específico por su ID.',
  })
  @ApiParam({ name: 'userId', example: 1, description: 'ID del usuario propietario de la cuenta' })
  @ApiResponse({ status: 200, description: 'Cuenta encontrada',   type: AccountResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado'       })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  findByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<AccountResponseDto> {
    return this.accountsService.findByUserId(userId);
  }
}