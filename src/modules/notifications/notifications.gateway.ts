import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Mapa userId → socketId
  private userSockets = new Map<number, string>();

  isConnected(userId: number): boolean {
    return this.userSockets.has(userId);
  }

  getSocketId(userId: number): string | undefined {
    return this.userSockets.get(userId);
  }

  handleConnection(client: Socket) {
    const userId = Number(client.handshake.query.userId);
    if (userId) {
      this.userSockets.set(userId, client.id);
      this.logger.log(`Usuario ${userId} conectado con socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        this.logger.log(`Usuario ${userId} desconectado`);
        break;
      }
    }
  }

  // Notifica al emisor y al receptor de una transferencia exitosa
  notifyTransfer(payload: {
    fromUserId: number;
    toUserId: number;
    amount: number;
    transactionId: number;
    newBalanceFrom: number;
    newBalanceTo: number;
    timestamp: Date;
  }) {
    const fromSocketId = this.userSockets.get(payload.fromUserId);
    const toSocketId = this.userSockets.get(payload.toUserId);

    if (fromSocketId) {
      this.server.to(fromSocketId).emit('transfer_sent', {
        message: 'Transferencia enviada exitosamente',
        transactionId: payload.transactionId,
        amount: payload.amount,
        newBalance: payload.newBalanceFrom,
        timestamp: payload.timestamp,
      });
    }

    if (toSocketId) {
      this.server.to(toSocketId).emit('transfer_received', {
        message: 'Has recibido una transferencia',
        transactionId: payload.transactionId,
        amount: payload.amount,
        newBalance: payload.newBalanceTo,
        timestamp: payload.timestamp,
      });
    }
  }
}
