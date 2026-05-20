import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { NotificationsGateway } from './notifications.gateway';
import { ConnectedUsersService } from './connected-users.service';
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

  constructor(
    private readonly gateway: NotificationsGateway,
    @Inject(ConnectedUsersService)
    private readonly connectedUsersService: ConnectedUsersService,
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) {}

  
  async notifyTransfer(userId: number, payload: TransferNotificationPayload) {
    try {
      // 1. Intentar enviar por WebSocket si el usuario está conectado
      const isConnected = this.isConnected(userId);

      if (isConnected) {
        this.logger.log(
          `📨 Enviando notificación vía WebSocket al usuario ${userId}`,
        );

        if (payload.type === 'TRANSFER') {
          if (userId === payload.fromAccountId) {
            this.gateway.notifyTransferSent(userId, {
              transactionId: payload.transactionId || 0,
              amount: payload.amount,
              toEmail: 'usuario destinatario',
              newBalance: 0,
              timestamp: payload.created_at || new Date(),
            });
          } else {
            this.gateway.notifyTransferReceived(userId, {
              transactionId: payload.transactionId || 0,
              amount: payload.amount,
              fromEmail: 'usuario remitente',
              newBalance: 0,
              timestamp: payload.created_at || new Date(),
            });
          }
        } else if (payload.type === 'DEPOSIT') {
          this.gateway.sendNotificationToUser(userId, 'deposit_received', {
            message: 'Depósito recibido exitosamente',
            transactionId: payload.transactionId,
            amount: payload.amount,
            timestamp: payload.created_at || new Date(),
          });
        } else if (payload.type === 'WITHDRAW') {
          this.gateway.sendNotificationToUser(userId, 'withdraw_completed', {
            message: 'Retiro procesado exitosamente',
            transactionId: payload.transactionId,
            amount: payload.amount,
            timestamp: payload.created_at || new Date(),
          });
        }
      } else {
        this.logger.warn(
          ` Usuario ${userId} no está conectado - se enviará por correo`,
        );
      }

      // 2. Emitir evento interno (para pruebas unitarias)
      this.emitter.emit('transfer_notification', { userId, payload });

      // 3. Enviar notificación por correo en segundo plano (no bloquea)
      this.sendEmailNotificationAsync(userId, payload);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        ` Error en notifyTransfer: ${errorMessage}`,
        error,
      );
    }
  }

  
  private async sendEmailNotificationAsync(
    userId: number,
    payload: TransferNotificationPayload,
  ): Promise<void> {
    try {
      const user = await this.userService.findOne(userId);

      if (!user || !user.email) {
        this.logger.debug(
          `No se pudo enviar correo al usuario ${userId}: sin email registrado`,
        );
        return;
      }

      let subject = '';
      let typeStr = '';

      // Determinar asunto según tipo de notificación
      switch (payload.type) {
        case 'TRANSFER':
          subject = 'Aviso de Transferencia - PayFlow';
          typeStr =
            userId === payload.fromAccountId
              ? 'Transferencia Enviada'
              : 'Transferencia Recibida';
          break;
        case 'DEPOSIT':
          subject = 'Aviso de Depósito Recibido - PayFlow';
          typeStr = 'Depósito';
          break;
        case 'WITHDRAW':
          subject = 'Aviso de Retiro Exitoso - PayFlow';
          typeStr = 'Retiro';
          break;
        default:
          subject = 'Movimiento de Cuenta - PayFlow';
          typeStr = payload.type;
      }

      // Enviar correo
      await this.mailService.sendTransactionEmail(user.email, subject, {
        transactionId: payload.transactionId || 0,
        type: typeStr,
        amount: payload.amount,
        status: payload.status,
        timestamp: payload.created_at || new Date(),
      });

      this.logger.log(`✉️ Correo enviado al usuario ${userId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        ` Error al enviar correo al usuario ${userId}: ${errorMessage}`,
      );
    }
  }

 
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

  
  onTransferNotification(
    listener: (data: { userId: number; payload: TransferNotificationPayload }) => void,
  ) {
    this.emitter.on('transfer_notification', listener);
  }

  
  isConnected(userId: number): boolean {
    return this.connectedUsersService.isConnected(userId);
  }

  
  getSocketId(userId: number): string | undefined {
    return this.connectedUsersService.getSocketId(userId);
  }

    
  
  sendCustomNotification(userId: number, eventName: string, data: any) {
    if (this.isConnected(userId)) {
      this.gateway.sendNotificationToUser(userId, eventName, data);
    } else {
      this.logger.warn(
        ` Usuario ${userId} no está conectado para recibir evento '${eventName}'`,
      );
    }
  }
}

