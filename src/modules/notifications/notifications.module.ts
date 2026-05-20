import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { ConnectedUsersService } from './connected-users.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { UserModule } from '../user/user.module';
import { MailModule } from '../../mail/mail.module';


@Module({
  imports: [
   
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
    NotificationsGateway,
    NotificationsService,
    ConnectedUsersService,
    WsJwtGuard,
  ],
  exports: [NotificationsService, ConnectedUsersService, NotificationsGateway],
})
export class NotificationsModule {}

