import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../entities/user/user.entity';

@Injectable()
export class TransferService {
  constructor(private dataSource: DataSource) {}

  async transfer(fromId: number, toId: number, amount: number) {
    if (fromId === toId) {
      throw new BadRequestException('No puedes transferirte a ti mismo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar origen
      const fromUser = await queryRunner.manager.findOne(User, {
        where: { id: fromId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromUser) {
        throw new BadRequestException('Usuario de origen no encontrado.');
      }

      const exactAmount = Number(amount);
      const fromUserSaldo = Number(fromUser.saldo);

      // 2. Validar fondos suficientes
      if (fromUserSaldo < exactAmount) {
        throw new BadRequestException('Fondos insuficientes.');
      }

      // 3. Validar destino
      const toUser = await queryRunner.manager.findOne(User, {
        where: { id: toId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!toUser) {
        throw new BadRequestException('Usuario de destino no encontrado.');
      }

      // 4. Actualizar saldos
      fromUser.saldo = Number((fromUserSaldo - exactAmount).toFixed(2));
      toUser.saldo = Number((Number(toUser.saldo) + exactAmount).toFixed(2));

      await queryRunner.manager.save(User, fromUser);
      await queryRunner.manager.save(User, toUser);

      await queryRunner.commitTransaction();

      return {
        message: 'Transferencia exitosa',
        fromUser: {
          id: fromUser.id,
          saldo: fromUser.saldo,
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo la transferencia.');
    } finally {
      await queryRunner.release();
    }
  }
}
