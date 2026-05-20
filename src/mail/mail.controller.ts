import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { MailService } from './mail.service';
import { RequestOtpDto } from './dto/request-otp.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  // POST /mail/request-otp
  @Post('request-otp')
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.mailService.sendOtp(requestOtpDto.email);
  }

  // POST /mail/verify-otp
  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; code: string }) {
    if (!body.email || !body.code) {
      throw new BadRequestException('El correo y el código OTP son requeridos.');
    }
    const isValid = this.mailService.verifyOtp(body.email, body.code);
    if (!isValid) {
      throw new BadRequestException('El código OTP es inválido o ha expirado.');
    }
    return { message: 'Código OTP verificado exitosamente.' };
  }
}
