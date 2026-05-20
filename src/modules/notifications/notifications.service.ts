import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { NotificationsGateway } from './notifications.gateway';
import { UserService } from '../user/user.service';
import { MailService } from '../../mail/mail.service';

export interface TransferNotificationPayload {
  transactionId?: number;
  type: string;
  amount: number;
  fromAccountId?: number;
  toAccountId?: number;
  status: string;
  created_at?: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emitter = new EventEmitter();
  // Mantener un registro simple de sesiones activas (userId -> connected) como fallback
  private readonly activeSessions = new Set<number>();

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) {}

  notifyTransfer(userId: number, payload: TransferNotificationPayload) {
    // 1. Emitir por WebSocket si tiene sesión activa en tiempo real
    if (this.isConnected(userId)) {
      this.logger.log(`Notificando al usuario ${userId} vía WS: ${JSON.stringify(payload)}`);
      const socketId = this.gateway.getSocketId(userId);
      if (socketId && this.gateway.server) {
        if (payload.type === 'TRANSFER') {
          if (userId === payload.fromAccountId) {
            this.gateway.server.to(socketId).emit('transfer_sent', {
              message: 'Transferencia enviada exitosamente',
              transactionId: payload.transactionId,
              amount: payload.amount,
              timestamp: payload.created_at || new Date(),
            });
          } else {
            this.gateway.server.to(socketId).emit('transfer_received', {
              message: 'Has recibido una transferencia',
              transactionId: payload.transactionId,
              amount: payload.amount,
              timestamp: payload.created_at || new Date(),
            });
          }
        } else if (payload.type === 'DEPOSIT') {
          this.gateway.server.to(socketId).emit('deposit_received', {
            message: 'Depósito recibido exitosamente',
            transactionId: payload.transactionId,
            amount: payload.amount,
            timestamp: payload.created_at || new Date(),
          });
        } else if (payload.type === 'WITHDRAW') {
          this.gateway.server.to(socketId).emit('withdraw_completed', {
            message: 'Retiro procesado exitosamente',
            transactionId: payload.transactionId,
            amount: payload.amount,
            timestamp: payload.created_at || new Date(),
          });
        }
      }
    } else {
      this.logger.debug(`No se notifica por WS a ${userId}: sesión no activa`);
    }

    // 2. Emitir evento interno (útil para pruebas unitarias)
    this.emitter.emit('transfer_notification', { userId, payload });

    // 3. Enviar notificación por correo de fondo (Nodemailer) - No bloquea la petición WS/HTTP
    this.sendEmailNotificationAsync(userId, payload);
  }

  // Envía la notificación de transferencia por correo en segundo plano
  private async sendEmailNotificationAsync(userId: number, payload: TransferNotificationPayload) {
    try {
      const user = await this.userService.findOne(userId);
      if (!user || !user.email) {
        this.logger.debug(`No se pudo enviar correo al usuario ${userId}: no tiene email registrado.`);
        return;
      }

      let subject = '';
      let typeStr = '';

      if (payload.type === 'TRANSFER') {
        subject = 'Aviso de Transferencia - PayFlow';
        typeStr = userId === payload.fromAccountId ? 'Transferencia Enviada' : 'Transferencia Recibida';
      } else if (payload.type === 'DEPOSIT') {
        subject = 'Aviso de Depósito Recibido - PayFlow';
        typeStr = 'Depósito';
      } else if (payload.type === 'WITHDRAW') {
        subject = 'Aviso de Retiro Exitoso - PayFlow';
        typeStr = 'Retiro';
      } else {
        subject = 'Movimiento de Cuenta - PayFlow';
        typeStr = payload.type;
      }

      await this.mailService.sendTransactionEmail(user.email, subject, {
        transactionId: payload.transactionId || 0,
        type: typeStr,
        amount: payload.amount,
        status: payload.status,
        timestamp: payload.created_at || new Date(),
      });
    } catch (err: any) {
      this.logger.error(`Error en segundo plano al enviar correo al usuario ${userId}: ${err.message}`);
    }
  }

  // Compatible con la invocación directa de la rama de Ana
  sendTransferNotification(payload: {
    fromUserId: number;
    toUserId: number;
    amount: number;
    transactionId: number;
    newBalanceFrom: number;
    newBalanceTo: number;
    timestamp: Date;
  }) {
    this.gateway.notifyTransfer(payload);
  }

  // Permite suscribirse a eventos en procesos internos (útil para pruebas)
  onTransferNotification(
    listener: (data: { userId: number; payload: TransferNotificationPayload }) => void,
  ) {
    this.emitter.on('transfer_notification', listener);
  }

  // Registro de sesión local (fallback o manual)
  connect(userId: number) {
    this.activeSessions.add(userId);
    this.logger.debug(`User ${userId} connected to notifications`);
  }

  // Desconectar local
  disconnect(userId: number) {
    this.activeSessions.delete(userId);
    this.logger.debug(`User ${userId} disconnected from notifications`);
  }

  isConnected(userId: number): boolean {
    return this.gateway.isConnected(userId) || this.activeSessions.has(userId);
  }
}
