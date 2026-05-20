import { Test } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { AccountsService } from '../account/accounts.service';
import { DataSource } from 'typeorm';
import { Account } from '../../entities/account/account.entity';
import { Transaction, TransactionStatus } from '../../entities/transfer/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';

describe('TransferService (unit)', () => {
  let transferService: TransferService;

  const mockAccountsService = {
    findAccountByUserId: jest.fn(),
    findAccountById: jest.fn(),
  } as unknown as AccountsService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    },
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  } as unknown as DataSource;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: DataSource, useValue: mockDataSource },
  // Provide NotificationsService by class token (as used in TransferService constructor)
  { provide: NotificationsService, useValue: { isConnected: jest.fn(), notifyTransfer: jest.fn() } },
      ],
    }).compile();

    transferService = moduleRef.get(TransferService);
  });

  it('should perform a transfer and mark transaction PENDING then SUCCESS', async () => {
    const fromAcc: Account = { id: 1, saldo: 200, created_at: new Date(), user: { id: 10 } } as any;
    const toAcc: Account = { id: 2, saldo: 50, created_at: new Date(), user: { id: 20 } } as any;

    mockAccountsService.findAccountByUserId = jest.fn().mockResolvedValue(fromAcc);
    mockAccountsService.findAccountById = jest.fn().mockResolvedValue(toAcc);

    const createdTx = { id: 123, type: 'TRANSFER', amount: 100, status: TransactionStatus.PENDING, created_at: new Date() } as Transaction;
    mockQueryRunner.manager.create = jest.fn().mockReturnValue(createdTx);
    mockQueryRunner.manager.save = jest.fn().mockResolvedValue(createdTx);
    // Simular bloqueo de cuentas: devolver fromAcc y toAcc según id
    mockQueryRunner.manager.findOne = jest.fn().mockImplementation((entity, opts) => {
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
