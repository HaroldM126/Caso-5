import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification/notification.entity';
import { User } from '../../entities/user/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationListener } from './notification.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [NotificationsService, NotificationListener],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
