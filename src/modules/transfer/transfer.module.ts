import { Module } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user/user.entity';
import { AccountModule } from '../account/account.module';
import { Transaction } from '../../entities/transfer/transaction.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Transaction]),
    AccountModule,
    NotificationsModule,
  ],
  providers: [TransferService],
  controllers: [TransferController],
})
export class TransferModule {}
