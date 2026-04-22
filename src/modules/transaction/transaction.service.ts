import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Transaction } from '../../entities/transfer/transaction.entity';
import { FilterTransactionsDto } from '../../dtos/transaction/filter-transactions.dto';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private applyFilters(query: SelectQueryBuilder<Transaction>, filters: FilterTransactionsDto) {
    const { type, fromDate, toDate, page = 1, limit = 10 } = filters;

    if (type) {
      query.andWhere('transaction.type = :type', { type });
    }

    if (fromDate) {
      query.andWhere('transaction.created_at >= :fromDate', { fromDate });
    }

    if (toDate) {
      query.andWhere('transaction.created_at <= :toDate', { toDate });
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);
    
    query.orderBy('transaction.created_at', 'DESC');

    return query;
  }

  async getMyTransactions(userId: number, filters: FilterTransactionsDto) {
    const query = this.transactionRepository.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.fromAccount', 'fromAccount')
      .leftJoin('fromAccount.user', 'fromUser')
      .addSelect(['fromUser.id', 'fromUser.nombre', 'fromUser.email', 'fromUser.role'])
      .leftJoinAndSelect('transaction.toAccount', 'toAccount')
      .leftJoin('toAccount.user', 'toUser')
      .addSelect(['toUser.id', 'toUser.nombre', 'toUser.email', 'toUser.role'])
      .where('(fromUser.id = :userId OR toUser.id = :userId)', { userId });

    this.applyFilters(query, filters);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page: filters.page || 1,
      limit: filters.limit || 10,
    };
  }

  async getAllTransactions(filters: FilterTransactionsDto) {
    const query = this.transactionRepository.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.fromAccount', 'fromAccount')
      .leftJoin('fromAccount.user', 'fromUser')
      .addSelect(['fromUser.id', 'fromUser.nombre', 'fromUser.email', 'fromUser.role'])
      .leftJoinAndSelect('transaction.toAccount', 'toAccount')
      .leftJoin('toAccount.user', 'toUser')
      .addSelect(['toUser.id', 'toUser.nombre', 'toUser.email', 'toUser.role']);

    this.applyFilters(query, filters);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page: filters.page || 1,
      limit: filters.limit || 10,
    };
  }
}
