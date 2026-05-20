import { Injectable, Inject, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as crypto from 'crypto';
import { OtpStorageService } from './otp/otp-storage.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject('MAIL_TRANSPORTER') private readonly transporter: nodemailer.Transporter,
    private readonly otpStorageService: OtpStorageService,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(email: string) {
    try {
      // Generar OTP numérico de 6 dígitos de forma segura (crypto.randomInt)
      const code = crypto.randomInt(100000, 999999).toString();
      const ttlMs = 5 * 60 * 1000; // TTL fijo en código (5 minutos)
      
      this.otpStorageService.saveOtp(email, code, ttlMs);

      // Resolver ruta de la plantilla Handlebars en tiempo de ejecución compilada
      // 'dist/mail/mail.service.js' sube un nivel '..' a 'dist/' y luego entra a 'templates/'
      const templatePath = path.join(__dirname, '..', 'templates', 'otp-email.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      
      const html = template({ code, expiresInMinutes: 5 });

      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM') || 'no-reply@payflow.com',
        to: email,
        subject: 'Código OTP de Seguridad - PayFlow',
        html,
      });

      this.logger.log(`Código OTP generado y enviado a ${email}`);
      return { message: 'Código OTP enviado exitosamente' };
    } catch (error: any) {
      this.logger.error(`Error al enviar OTP a ${email}: ${error.message}`, error.stack);
      // Respuesta HTTP adecuada: mensaje genérico al cliente sin revelar datos internos
      throw new InternalServerErrorException('Error interno al procesar el envío de correo.');
    }
  }

  // Verifica el código OTP directamente llamando al Storage
  verifyOtp(email: string, code: string): boolean {
    return this.otpStorageService.verifyOtp(email, code);
  }

  // Envía una notificación de transacción (transferencia, depósito, retiro) por correo
  async sendTransactionEmail(
    email: string,
    subject: string,
    payload: {
      transactionId: number;
      type: string;
      amount: number;
      status: string;
      timestamp: Date;
    },
  ) {
    try {
      const templatePath = path.join(__dirname, '..', 'templates', 'transaction-email.hbs');
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);

      const html = template({
        transactionId: payload.transactionId,
        type: payload.type,
        amount: payload.amount.toFixed(2),
        status: payload.status,
        timestamp: payload.timestamp.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      });

      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM') || 'no-reply@payflow.com',
        to: email,
        subject,
        html,
      });

      this.logger.log(`Notificación de transacción enviada por correo a ${email}`);
    } catch (error: any) {
      this.logger.error(`Error al enviar notificación de transacción a ${email}: ${error.message}`);
      // No arrojamos excepción aquí para no bloquear el flujo de la transferencia si falla el correo
    }
  }
}
