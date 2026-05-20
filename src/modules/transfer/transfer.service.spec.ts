import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TransferService } from './transfer.service';
import { AccountsService } from '../account/accounts.service';
import { DataSource } from 'typeorm';
import { Account } from '../../entities/account/account.entity';
import { Transaction, TransactionStatus } from '../../entities/transfer/transaction.entity';

import { NotificationsService } from '../notifications/notifications.service';

describe('TransferService (unit)', () => {
  let transferService: TransferService;

  const rawMockAccountsService = {
    findAccountByUserId: jest.fn() as jest.MockedFunction<(userId: number) => Promise<Account>>,
    findAccountById: jest.fn() as jest.MockedFunction<(accountId: number) => Promise<Account>>,
  };

  const mockAccountsService = rawMockAccountsService as unknown as jest.Mocked<AccountsService>;

  const rawMockQueryRunner = {
    connect: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    startTransaction: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    manager: {
      findOne: jest.fn() as jest.MockedFunction<(entity: any, opts?: any) => Promise<any>>,
      save: jest.fn() as jest.MockedFunction<(entity: any) => Promise<any>>,
      create: jest.fn() as jest.MockedFunction<(dto: any) => any>,
    },
    commitTransaction: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    rollbackTransaction: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    release: jest.fn() as jest.MockedFunction<() => Promise<void>>,
  };

  const mockQueryRunner = rawMockQueryRunner as unknown as jest.Mocked<any>;

  const rawMockDataSource = {
    createQueryRunner: jest.fn(() => rawMockQueryRunner),
  };

  const mockDataSource = jest.mocked(rawMockDataSource, { shallow: true }) as unknown as jest.Mocked<DataSource>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificationsService, useValue: { isConnected: jest.fn(), notifyTransfer: jest.fn() } },
      ],
    }).compile();

    transferService = moduleRef.get(TransferService);
  });

  it('should perform a transfer and mark transaction PENDING then SUCCESS', async () => {
    const fromAcc: Account = { id: 1, saldo: 200, created_at: new Date(), user: { id: 10 } } as any;
    const toAcc: Account = { id: 2, saldo: 50, created_at: new Date(), user: { id: 20 } } as any;

    mockAccountsService.findAccountByUserId.mockResolvedValue(fromAcc);
    mockAccountsService.findAccountById.mockResolvedValue(toAcc);

    const createdTx = { id: 123, type: 'TRANSFER', amount: 100, status: TransactionStatus.PENDING, created_at: new Date() } as Transaction;
    mockQueryRunner.manager.create.mockReturnValue(createdTx);
    mockQueryRunner.manager.save.mockResolvedValue(createdTx);
    // Simular bloqueo de cuentas: devolver fromAcc y toAcc según id
    mockQueryRunner.manager.findOne.mockImplementation((entity: any, opts: any) => {
      const id = opts?.where?.id;
      if (id === fromAcc.id) return Promise.resolve(fromAcc);
      if (id === toAcc.id) return Promise.resolve(toAcc);
      return Promise.resolve(undefined);
    });

    const result = await transferService.transfer(10, 2, 100);

    expect(result).toBeDefined();
    expect(result.message).toContain('Transferencia exitosa');
    expect(createdTx.status).toBe(TransactionStatus.SUCCESS);
  });
});
