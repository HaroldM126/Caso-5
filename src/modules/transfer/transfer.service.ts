import { NotificationsService } from '../notifications/notifications.service';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../../entities/account/account.entity';
import { AccountsService } from '../account/accounts.service';
import {
  Transaction,
  TransactionType,
} from '../../entities/transfer/transaction.entity';

@Injectable()
export class TransferService {
  constructor(
    private dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
      // Obtener las cuentas involucradas
      const fromAccount =
        await this.accountsService.findAccountByUserId(fromId);
      const toAccount = await this.accountsService.findAccountById(toId);

      // Para evitar deadlocks, bloqueamos las cuentas en orden ascendente de ID
      const [firstId, secondId] = [fromAccount.id, toAccount.id].sort(
        (a, b) => a - b,
      );

      // Bloqueo 1
      const acc1 = await queryRunner.manager.findOne(Account, {
        where: { id: firstId },
        lock: { mode: 'pessimistic_write' },
      });

      // Bloqueo 2
      const acc2 = await queryRunner.manager.findOne(Account, {
        where: { id: secondId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!acc1 || !acc2) {
        throw new BadRequestException('Una o ambas cuentas no existen.');
      }

      // Asignar roles después de bloquear
      const sourceAcc = acc1.id === fromAccount.id ? acc1 : acc2;
      const destAcc = acc1.id === toAccount.id ? acc1 : acc2;

      const fromSaldo = Number(sourceAcc.saldo);

      // Validar fondos suficientes
      if (fromSaldo < exactAmount) {
        throw new BadRequestException('Fondos insuficientes.');
      }

      // Actualizar saldos con precisión decimal
      sourceAcc.saldo = Number((fromSaldo - exactAmount).toFixed(2));
      destAcc.saldo = Number((Number(destAcc.saldo) + exactAmount).toFixed(2));

      await queryRunner.manager.save(Account, sourceAcc);
      await queryRunner.manager.save(Account, destAcc);

      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.TRANSFER,
        amount: exactAmount,
        fromAccount: sourceAcc,
        toAccount: destAcc,
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      // se modificopara llamar la notificacion (notificación en tiempo real)
      this.notificationsService.sendTransferNotification({
        fromUserId: fromId,
        toUserId: toId,
        amount: exactAmount,
        transactionId: transaction.id,
        newBalanceFrom: sourceAcc.saldo,
        newBalanceTo: destAcc.saldo,
        timestamp: new Date(),
      });

      return {
        message: 'Transferencia exitosa',
        fromAccount: {
          id: sourceAcc.id,
          saldo: sourceAcc.saldo,
        },
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Fallo la transferencia: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // Depósito: solo ADMIN (controlado en el controller via @Roles)
  async deposit(toAccountId: number, amount: number) {
    const exactAmount = Number(amount);
    if (isNaN(exactAmount) || exactAmount <= 0) {
      throw new BadRequestException('El monto debe ser un número positivo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await queryRunner.manager.findOne(Account, {
        where: { id: toAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new BadRequestException('Cuenta destino no encontrada.');
      }

      const newBalance = Number(
        (Number(account.saldo) + exactAmount).toFixed(2),
      );
      account.saldo = newBalance;

      await queryRunner.manager.save(Account, account);

      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.DEPOSIT,
        amount: exactAmount,
        toAccount: account,
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      return {
        message: 'Depósito exitoso',
        accountId: account.id,
        saldo: newBalance,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Fallo el depósito: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // Retiro: role USER (controlado en el controller via @Roles)
  async withdraw(userId: number, amount: number) {
    const exactAmount = Number(amount);
    if (isNaN(exactAmount) || exactAmount <= 0) {
      throw new BadRequestException('El monto debe ser un número positivo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtenemos la cuenta base desde userId para tener el id
      const userAccount =
        await this.accountsService.findAccountByUserId(userId);

      const account = await queryRunner.manager.findOne(Account, {
        where: { id: userAccount.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new BadRequestException('Cuenta no encontrada.');
      }

      const current = Number(account.saldo);
      if (current < exactAmount) {
        throw new BadRequestException('Fondos insuficientes.');
      }

      const newBalance = Number((current - exactAmount).toFixed(2));
      account.saldo = newBalance;

      await queryRunner.manager.save(Account, account);

      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.WITHDRAW,
        amount: exactAmount,
        fromAccount: account,
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      return {
        message: 'Retiro exitoso',
        accountId: account.id,
        saldo: newBalance,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo el retiro: ' + err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
