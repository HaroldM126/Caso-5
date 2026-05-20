import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { UserModule } from '../user/user.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [UserModule, MailModule],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
