import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../../entities/account/account.entity';
import { AccountsService } from '../account/accounts.service';
import { Transaction, TransactionType, TransactionStatus } from '../../entities/transfer/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';

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
      const fromAccount = await this.accountsService.findAccountByUserId(fromId);
      const toAccount = await this.accountsService.findAccountById(toId);

      // Seguridad: asegurarnos que la cuenta origen pertenece al usuario que solicita
      if (!fromAccount.user || fromAccount.user.id !== fromId) {
        throw new ForbiddenException('No tiene permiso sobre la cuenta origen.');
      }

      // Para evitar deadlocks, bloqueamos las cuentas en orden ascendente de ID
      const [firstId, secondId] = [fromAccount.id, toAccount.id].sort((a, b) => a - b);

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


  // Crear transacción en estado PENDING
  const transaction = queryRunner.manager.create(Transaction, {
    type: TransactionType.TRANSFER,
    amount: exactAmount,
    fromAccount: sourceAcc,
    toAccount: destAcc,
    status: TransactionStatus.PENDING,
  });
  await queryRunner.manager.save(Transaction, transaction);

  // Actualizar saldos con precisión decimal
  sourceAcc.saldo = Number((fromSaldo - exactAmount).toFixed(2));
  destAcc.saldo = Number((Number(destAcc.saldo) + exactAmount).toFixed(2));

  await queryRunner.manager.save(Account, sourceAcc);
  await queryRunner.manager.save(Account, destAcc);

      await queryRunner.commitTransaction();

      // Marcar transacción como SUCCESS
      try {
        transaction.status = TransactionStatus.SUCCESS;
        await queryRunner.manager.save(Transaction, transaction);
      } catch {
        // no impedir la respuesta si setear el status falla; el estado puede ser corregido por un job
      }

      // Notificar al emisor y receptor (solo si la sesión está activa)
      try {
        const fromUserId = sourceAcc.user?.id ?? (await this.accountsService.findAccountById(sourceAcc.id)).user.id;
        const toUserId = destAcc.user?.id ?? (await this.accountsService.findAccountById(destAcc.id)).user.id;
        const payload = {
          transactionId: transaction.id,
          type: TransactionType.TRANSFER,
          amount: transaction.amount,
          fromAccountId: sourceAcc.id,
          toAccountId: destAcc.id,
          status: transaction.status,
          created_at: transaction.created_at,
        };

        this.notificationsService.notifyTransfer(fromUserId, payload as any);
        this.notificationsService.notifyTransfer(toUserId, payload as any);
        this.notifyBalanceUpdate(fromUserId, sourceAcc);
        this.notifyBalanceUpdate(toUserId, destAcc);
      } catch {
        // no bloquear por errores en notificaciones
      }

      return {
        message: 'Transferencia exitosa',
        fromAccount: {
          id: sourceAcc.id,
          saldo: sourceAcc.saldo,
        },
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      // Intentar marcar la transacción como FAILED si existe
      try {
        const maybeTx = await queryRunner.manager.findOne(Transaction, { where: { fromAccount: { id: fromId } } });
        if (maybeTx) {
          maybeTx.status = TransactionStatus.FAILED;
          await queryRunner.manager.save(Transaction, maybeTx);
        }
      } catch {
        // ignore
      }

      if (err instanceof BadRequestException || err instanceof ForbiddenException) {
        throw err;
      }
      // No exponer detalles técnicos al usuario
      throw new InternalServerErrorException('Error interno al procesar la transferencia.');
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

      const newBalance = Number((Number(account.saldo) + exactAmount).toFixed(2));
      account.saldo = newBalance;

      await queryRunner.manager.save(Account, account);

      // crear transacción PENDING
      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.DEPOSIT,
        amount: exactAmount,
        toAccount: account,
        status: TransactionStatus.PENDING,
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      // marcar SUCCESS
      try {
        transaction.status = TransactionStatus.SUCCESS;
        await queryRunner.manager.save(Transaction, transaction);
      } catch {
        // ignored
      }

      // Notificar propietario si está conectado
      try {
        const userId = account.user?.id ?? (await this.accountsService.findAccountById(account.id)).user.id;
        const payload = {
          transactionId: transaction.id,
          type: TransactionType.DEPOSIT,
          amount: exactAmount,
          toAccountId: account.id,
          status: transaction.status,
          created_at: transaction.created_at,
        };
        if (this.notificationsService.isConnected(userId)) {
          this.notificationsService.notifyTransfer(userId, payload as any);
        }
        this.notificationsService.sendCustomNotification(userId, 'balance.updated', {
          accountId: account.id,
          saldo: newBalance,
          type: TransactionType.DEPOSIT,
          updatedAt: transaction.created_at,
        });
      } catch {
        // ignore
      }

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
      throw new InternalServerErrorException('Error interno al procesar el depósito.');
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
      const userAccount = await this.accountsService.findAccountByUserId(userId);
      
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
        status: TransactionStatus.PENDING,
      });
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      // marcar SUCCESS
      try {
        transaction.status = TransactionStatus.SUCCESS;
        await queryRunner.manager.save(Transaction, transaction);
      } catch {
        // ignored
      }

      // Notificar propietario si está conectado
      try {
        const userId = account.user?.id ?? (await this.accountsService.findAccountById(account.id)).user.id;
        const payload = {
          transactionId: transaction.id,
          type: TransactionType.WITHDRAW,
          amount: exactAmount,
          fromAccountId: account.id,
          status: transaction.status,
          created_at: transaction.created_at,
        };
        if (this.notificationsService.isConnected(userId)) {
          this.notificationsService.notifyTransfer(userId, payload as any);
        }
        this.notificationsService.sendCustomNotification(userId, 'balance.updated', {
          accountId: account.id,
          saldo: newBalance,
          type: TransactionType.WITHDRAW,
          updatedAt: transaction.created_at,
        });
      } catch {
        // ignore
      }

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

  private notifyBalanceUpdate(userId: number, account: Account) {
    this.notificationsService.sendCustomNotification(userId, 'balance.updated', {
      accountId: account.id,
      saldo: Number(account.saldo),
      updatedAt: new Date(),
    });
  }
}
