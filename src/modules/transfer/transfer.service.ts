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

    const exactAmount = Number(amount);
    if (isNaN(exactAmount) || exactAmount <= 0) {
      throw new BadRequestException('El monto debe ser un número positivo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Para evitar deadlocks, bloqueamos las cuentas en orden ascendente de ID
      const [firstId, secondId] = [fromId, toId].sort((a, b) => a - b);

      // Precargar usuarios en el orden correcto
      let fromUser: User;
      let toUser: User;

      // Bloqueo 1
      const user1 = await queryRunner.manager.findOne(User, {
        where: { id: firstId },
        lock: { mode: 'pessimistic_write' },
      });

      // Bloqueo 2
      const user2 = await queryRunner.manager.findOne(User, {
        where: { id: secondId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user1 || !user2) {
        throw new BadRequestException('Una o ambas cuentas no existen.');
      }

      // Asignar roles después de bloquear
      fromUser = user1.id === fromId ? user1 : user2;
      toUser = user1.id === toId ? user1 : user2;

      const fromUserSaldo = Number(fromUser.saldo);

      // Validar fondos suficientes
      if (fromUserSaldo < exactAmount) {
        throw new BadRequestException('Fondos insuficientes.');
      }

      // Actualizar saldos con precisión decimal
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
      throw new InternalServerErrorException('Fallo la transferencia: ' + err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
