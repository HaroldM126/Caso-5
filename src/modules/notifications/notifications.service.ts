import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { NotificationsGateway } from './notifications.gateway';

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

  constructor(private readonly gateway: NotificationsGateway) {}

  notifyTransfer(userId: number, payload: TransferNotificationPayload) {
    // Validar que la sesión del usuario está activa (ya sea por gateway o localmente)
    if (!this.isConnected(userId)) {
      this.logger.debug(`No se notifica a ${userId}: sesión no activa`);
      return;
    }

    this.logger.log(`Notify user ${userId}: ${JSON.stringify(payload)}`);
    // Emitir evento interno para que otros servicios (o tests) puedan escuchar
    this.emitter.emit('transfer_notification', { userId, payload });

    // Emitir evento en tiempo real por WebSocket
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
