import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailProvider } from './providers/mail.provider';
import { OtpStorageService } from './otp/otp-storage.service';

@Module({
  imports: [ConfigModule],
  controllers: [MailController],
  providers: [MailProvider, MailService, OtpStorageService],
  exports: [MailService],
})
export class MailModule {}
