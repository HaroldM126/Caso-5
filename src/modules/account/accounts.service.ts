import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/account/account.entity';
import { User } from '../../entities/user/user.entity';
import { AccountResponseDto } from '../../dtos/account/account_res.dto';
import { AccountSaldoDto } from '../../dtos/account/account_sal.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  private toResponseDto(account: Account): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.saldo = Number(account.saldo);
    dto.created_at = account.created_at;
    return dto;
  }

  private toBalanceDto(account: Account): AccountSaldoDto {
    const dto = new AccountSaldoDto();
    dto.saldo = Number(account.saldo);
    return dto;
  }

  public async findAccountByUserId(userId: number): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!account) {
      throw new NotFoundException(
        `Cuenta no encontrada para el usuario ${userId}`,
      );
    }

    return account;
  }

  public async findAccountById(accountId: number): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
      relations: ['user'],
    });

    if (!account) {
      throw new NotFoundException(`Cuenta con id ${accountId} no encontrada`);
    }

    return account;
  }

  private async accountExistsForUser(userId: number): Promise<boolean> {
    const count = await this.accountRepository.count({
      where: { user: { id: userId } },
    });

    return count > 0;
  }

  async createForUser(user: User): Promise<AccountResponseDto> {
    const exists = await this.accountExistsForUser(user.id);

    if (exists) {
      throw new ConflictException(
        `El usuario ${user.id} ya tiene una cuenta asociada`,
      );
    }

    const account = this.accountRepository.create({ user });
    const saved = await this.accountRepository.save(account);

    return this.toResponseDto(saved);
  }

  async findAll(): Promise<AccountResponseDto[]> {
    const accounts = await this.accountRepository.find({
      relations: ['user'],
    });

    return accounts.map((account) => this.toResponseDto(account));
  }

  async findByUserId(userId: number): Promise<AccountResponseDto> {
    const account = await this.findAccountByUserId(userId);
    return this.toResponseDto(account);
  }

  async findByAccountId(accountId: number): Promise<AccountResponseDto> {
    const account = await this.findAccountById(accountId);
    return this.toResponseDto(account);
  }

  async getBalance(userId: number): Promise<AccountSaldoDto> {
    const account = await this.findAccountByUserId(userId);
    return this.toBalanceDto(account);
  }

  async updateSaldo(accountId: number, newBalance: number): Promise<void> {
    await this.findAccountById(accountId); // valida que existe
    await this.accountRepository.update(accountId, { saldo: newBalance });
  }
}
