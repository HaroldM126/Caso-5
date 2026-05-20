import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

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
  // Mantener un registro simple de sesiones activas (userId -> connected)
  private readonly activeSessions = new Set<number>();

  notifyTransfer(userId: number, payload: TransferNotificationPayload) {
    // Validar que la sesión del usuario está activa antes de notificar
    if (!this.isConnected(userId)) {
      this.logger.debug(`No se notifica a ${userId}: sesión no activa`);
      return; // no notificar si el usuario no tiene sesión activa
    }

    // En un sistema real aquí enviaríamos via websocket, push, email, etc.
    this.logger.log(`Notify user ${userId}: ${JSON.stringify(payload)}`);
    // Emitir evento interno para que otros servicios (o tests) puedan escuchar
    this.emitter.emit('transfer_notification', { userId, payload });
  }

  // Permite suscribirse a eventos en procesos internos (útil para pruebas)
  onTransferNotification(
    listener: (data: { userId: number; payload: TransferNotificationPayload }) => void,
  ) {
    this.emitter.on('transfer_notification', listener);
  }

  // Registro simple de sesión: debe llamarse al hacer login / conectar socket
  connect(userId: number) {
    this.activeSessions.add(userId);
    this.logger.debug(`User ${userId} connected to notifications`);
  }

  // Desconectar (logout / desconexión socket)
  disconnect(userId: number) {
    this.activeSessions.delete(userId);
    this.logger.debug(`User ${userId} disconnected from notifications`);
  }

  isConnected(userId: number) {
    return this.activeSessions.has(userId);
  }
}
