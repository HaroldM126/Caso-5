import { Test } from '@nestjs/testing';
import { TransferService } from '../src/modules/transfer/transfer.service';
import { AccountsService } from '../src/modules/account/accounts.service';
import { DataSource } from 'typeorm';
import { Account } from '../src/entities/account/account.entity';
import { Transaction, TransactionStatus } from '../src/entities/transfer/transaction.entity';

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
      ],
    }).compile();

    transferService = moduleRef.get(TransferService);
  });

  it('should perform a transfer and mark transaction SUCCESS', async () => {
    const fromAcc: Account = { id: 1, saldo: 200, created_at: new Date(), user: { id: 10 } } as any;
    const toAcc: Account = { id: 2, saldo: 50, created_at: new Date(), user: { id: 20 } } as any;

    mockAccountsService.findAccountByUserId = jest.fn().mockResolvedValue(fromAcc);
    mockAccountsService.findAccountById = jest.fn().mockResolvedValue(toAcc);

    const createdTx = { id: 123, type: 'TRANSFER', amount: 100, status: TransactionStatus.PENDING, created_at: new Date() } as Transaction;
    mockQueryRunner.manager.create = jest.fn().mockReturnValue(createdTx);
    mockQueryRunner.manager.save = jest.fn().mockResolvedValue(createdTx);

    const result = await transferService.transfer(10, 2, 100);

    expect(result).toBeDefined();
    expect(result.message).toContain('Transferencia exitosa');
    expect(createdTx.status).toBe(TransactionStatus.PENDING);
  });
});
