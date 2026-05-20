import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Account } from '../../entities/account/account.entity';
import { AccountsService } from '../account/accounts.service';
import { Transaction, TransactionType, TransactionStatus } from '../../entities/transfer/transaction.entity';
import { OperationType } from '../../events/operation-type.enum';
import { OperationStatus } from '../../events/operation-status.enum';
import { BANK_OPERATION_EVENT, BankOperationEvent } from '../../events/bank-operation.event';

@Injectable()
export class TransferService {
  constructor(
    private dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private emitBankOperationEvent(event: BankOperationEvent) {
    this.eventEmitter.emit(BANK_OPERATION_EVENT, event);
  }

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

    let fromAccount: Account | null = null;
    let toAccount: Account | null = null;
    let transactionId: number | undefined = undefined;

    try {
      fromAccount = await this.accountsService.findAccountByUserId(fromId);
      toAccount = await this.accountsService.findAccountById(toId);

      const [firstId, secondId] = [fromAccount.id, toAccount.id].sort((a, b) => a - b);

      const acc1 = await queryRunner.manager.findOne(Account, {
        where: { id: firstId },
        lock: { mode: 'pessimistic_write' },
      });

      const acc2 = await queryRunner.manager.findOne(Account, {
        where: { id: secondId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!acc1 || !acc2) {
        throw new BadRequestException('Una o ambas cuentas no existen.');
      }

      const sourceAcc = acc1.id === fromAccount.id ? acc1 : acc2;
      const destAcc = acc1.id === toAccount.id ? acc1 : acc2;

      const fromSaldo = Number(sourceAcc.saldo);
      if (fromSaldo < exactAmount) {
        throw new BadRequestException('Fondos insuficientes.');
      }

      sourceAcc.saldo = Number((fromSaldo - exactAmount).toFixed(2));
      destAcc.saldo = Number((Number(destAcc.saldo) + exactAmount).toFixed(2));

      await queryRunner.manager.save(Account, sourceAcc);
      await queryRunner.manager.save(Account, destAcc);

      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.TRANSFER,
        amount: exactAmount,
        fromAccount: sourceAcc,
        toAccount: destAcc,
        status: TransactionStatus.SUCCESS,
      });
      const savedTransaction = await queryRunner.manager.save(Transaction, transaction);
      transactionId = savedTransaction.id;

      await queryRunner.commitTransaction();

      this.emitBankOperationEvent({
        userId: fromId,
        operationType: OperationType.TRANSFER,
        operationStatus: OperationStatus.SUCCESS,
        amount: exactAmount,
        fromAccountId: sourceAcc.id,
        toAccountId: destAcc.id,
        transactionId,
        initiatedById: fromId,
        message: `Transferencia exitosa de ${exactAmount} de la cuenta ${sourceAcc.id} a la cuenta ${destAcc.id}`,
        occurredAt: new Date().toISOString(),
        details: { sourceAccountId: sourceAcc.id, targetAccountId: destAcc.id },
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

      if (fromAccount) {
        this.emitBankOperationEvent({
          userId: fromId,
          operationType: OperationType.TRANSFER,
          operationStatus: OperationStatus.FAILED,
          amount: exactAmount,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount?.id,
          transactionId,
          initiatedById: fromId,
          message: `Transferencia fallida: ${err.message}`,
          occurredAt: new Date().toISOString(),
          details: { reason: err.message },
        });
      }

      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo la transferencia: ' + err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async deposit(toAccountId: number, amount: number) {
    const exactAmount = Number(amount);
    if (isNaN(exactAmount) || exactAmount <= 0) {
      throw new BadRequestException('El monto debe ser un número positivo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let account: Account | null = null;

    try {
      account = await queryRunner.manager.findOne(Account, {
        where: { id: toAccountId },
        relations: ['user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new BadRequestException('Cuenta destino no encontrada.');
      }

      const newBalance = Number((Number(account.saldo) + exactAmount).toFixed(2));
      account.saldo = newBalance;

      await queryRunner.manager.save(Account, account);

      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.DEPOSIT,
        amount: exactAmount,
        toAccount: account,
        status: TransactionStatus.SUCCESS,
      });
      const savedTransaction = await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      this.emitBankOperationEvent({
        userId: account.user.id,
        operationType: OperationType.DEPOSIT,
        operationStatus: OperationStatus.SUCCESS,
        amount: exactAmount,
        toAccountId: account.id,
        transactionId: savedTransaction.id,
        initiatedById: account.user.id,
        message: `Depósito exitoso de ${exactAmount} en la cuenta ${account.id}`,
        occurredAt: new Date().toISOString(),
        details: { targetAccountId: account.id, targetUserId: account.user.id },
      });

      return {
        message: 'Depósito exitoso',
        accountId: account.id,
        saldo: newBalance,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();

      if (account) {
        this.emitBankOperationEvent({
          userId: account.user.id,
          operationType: OperationType.DEPOSIT,
          operationStatus: OperationStatus.FAILED,
          amount: exactAmount,
          toAccountId: account.id,
          message: `Depósito fallido: ${err.message}`,
          occurredAt: new Date().toISOString(),
          details: { reason: err.message },
        });
      }

      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo el depósito: ' + err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async withdraw(userId: number, amount: number) {
    const exactAmount = Number(amount);
    if (isNaN(exactAmount) || exactAmount <= 0) {
      throw new BadRequestException('El monto debe ser un número positivo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let account: Account | null = null;

    try {
      const userAccount = await this.accountsService.findAccountByUserId(userId);

      account = await queryRunner.manager.findOne(Account, {
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
        status: TransactionStatus.SUCCESS,
      });
      const savedTransaction = await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();

      this.emitBankOperationEvent({
        userId,
        operationType: OperationType.WITHDRAW,
        operationStatus: OperationStatus.SUCCESS,
        amount: exactAmount,
        fromAccountId: account.id,
        transactionId: savedTransaction.id,
        initiatedById: userId,
        message: `Retiro exitoso de ${exactAmount} de la cuenta ${account.id}`,
        occurredAt: new Date().toISOString(),
        details: { sourceAccountId: account.id },
      });

      return {
        message: 'Retiro exitoso',
        accountId: account.id,
        saldo: newBalance,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.emitBankOperationEvent({
        userId,
        operationType: OperationType.WITHDRAW,
        operationStatus: OperationStatus.FAILED,
        amount: exactAmount,
        fromAccountId: account?.id,
        message: `Retiro fallido: ${err.message}`,
        occurredAt: new Date().toISOString(),
        details: { reason: err.message },
      });

      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Fallo el retiro: ' + err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
