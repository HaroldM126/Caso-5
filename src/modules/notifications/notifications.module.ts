import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from '../../entities/notification/notification.entity';
import { User } from '../../entities/user/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationListener } from './notification.listener';
import { NotificationsGateway } from './notifications.gateway';
import { ConnectedUsersService } from './connected-users.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { UserModule } from '../user/user.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
    UserModule,
    MailModule,
  ],
  providers: [
    NotificationsService,
    NotificationListener,
    NotificationsGateway,
    ConnectedUsersService,
    WsJwtGuard,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, ConnectedUsersService, NotificationsGateway],
})
export class NotificationsModule {}
