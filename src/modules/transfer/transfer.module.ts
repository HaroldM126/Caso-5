import { Module } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [TransferService],
  controllers: [TransferController],
})
export class TransferModule {}
