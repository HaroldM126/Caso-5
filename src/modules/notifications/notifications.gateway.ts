import {WebSocketGateway,WebSocketServer,OnGatewayConnection,OnGatewayDisconnect,SubscribeMessage,} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from './ws-jwt.guard';
import { ConnectedUsersService } from './connected-users.service';


@WebSocketGateway({
  cors: {
    origin: '*', 
    credentials: true,
  },
  namespace: '/notifications',
})

@UseGuards(WsJwtGuard)
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    @Inject(ConnectedUsersService)
    private readonly connectedUsersService: ConnectedUsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

 handleConnection(client: Socket) {
    try {
      
      let userId = client.data?.userId;
      let email = client.data?.email;

      if (!userId) {        
        const token =
          client.handshake.auth?.token ||
          client.handshake.query?.token ||
          (client.handshake.headers && client.handshake.headers.authorization
            ? (client.handshake.headers.authorization as string).split(' ')[1]
            : undefined);

        if (!token) {
          this.logger.warn(`Conexión sin userId ni token. Socket: ${client.id}`);
          client.disconnect(true);
          return;
        }

        try {
          const secret = this.configService.get<string>('JWT_SECRET');
          const decoded = this.jwtService.verify(token, { secret });
          client.data.user = decoded;
          userId = decoded.sub;
          email = decoded.email;
        } catch (err) {
          this.logger.warn(`Token inválido en handshake (Socket: ${client.id})`);
          client.disconnect(true);
          return;
        }
      }

      
      this.connectedUsersService.registerConnection(
        userId,
        client.id,
        email || 'unknown',
      );

      
      client.emit('connection_established', {
        message: 'Conexión establecida con éxito',
        userId,
        connectedAt: new Date(),
        socketId: client.id,
      });

           
      this.logger.log(
        ` Conexión exitosa - Usuario: ${email} (ID: ${userId}), Socket: ${client.id}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `Error en handleConnection: ${errorMessage}`,
        error,
      );
      client.disconnect(true);
    }
  }



  
  handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;
      const email = client.data.email;

      
      const wasConnected =
        this.connectedUsersService.disconnectBySocket(client.id);

      if (wasConnected) {
        
        client.broadcast.emit('user_disconnected', {
          userId,
          email,
          disconnectedAt: new Date(),
          totalConnected: this.connectedUsersService.getTotalConnected(),
        });

        this.logger.log(
          ` Desconexión - Usuario: ${email} (ID: ${userId}), Socket: ${client.id}`,
        );
      } else {
        this.logger.warn(
          ` Intento de desconectar usuario no registrado. Socket: ${client.id}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        ` Error en handleDisconnect: ${errorMessage}`,
        error,
      );
    }
  }

 
  @SubscribeMessage('ping')
  handlePing(client: Socket): { event: string; data: string } {
    const userId = client.data.userId;
    this.logger.debug(`Ping recibido de usuario ${userId}`);
    return { event: 'pong', data: `pong-${new Date().getTime()}` };
  }

  
  @SubscribeMessage('get_connection_status')
  handleGetConnectionStatus(client: Socket) {
    const userId = client.data.userId;
    const connectionInfo =
      this.connectedUsersService.getConnectionInfo(userId);

    return {
      event: 'connection_status',
      data: {
        userId,
        socketId: client.id,
        isConnected: true,
        connectedAt: connectionInfo?.connectedAt || new Date(),
      },
    };
  }
  
  notifyTransferSent(
    fromUserId: number,
    transactionData: {
      transactionId: number;
      amount: number;
      toEmail: string;
      newBalance: number;
      timestamp: Date;
    },
  ) {
    const socketId = this.connectedUsersService.getSocketId(fromUserId);

    if (socketId) {
      this.server.to(socketId).emit('transfer_sent', {
        message: 'Transferencia enviada exitosamente',
        transactionId: transactionData.transactionId,
        amount: transactionData.amount,
        toEmail: transactionData.toEmail,
        newBalance: transactionData.newBalance,
        timestamp: transactionData.timestamp,
      });

      this.logger.log(
        `📤 Notificación enviada al usuario ${fromUserId}: transferencia ID ${transactionData.transactionId}`,
      );
    } else {
      this.logger.warn(
        ` Usuario ${fromUserId} no está conectado para recibir notificación de transferencia`,
      );
    }
  }

  
  notifyTransferReceived(
    toUserId: number,
    transactionData: {
      transactionId: number;
      amount: number;
      fromEmail: string;
      newBalance: number;
      timestamp: Date;
    },
  ) {
    const socketId = this.connectedUsersService.getSocketId(toUserId);

    if (socketId) {
      this.server.to(socketId).emit('transfer_received', {
        message: '¡Has recibido una transferencia!',
        transactionId: transactionData.transactionId,
        amount: transactionData.amount,
        fromEmail: transactionData.fromEmail,
        newBalance: transactionData.newBalance,
        timestamp: transactionData.timestamp,
      });

      this.logger.log(
        `Notificación enviada al usuario ${toUserId}: transferencia recibida ID ${transactionData.transactionId}`,
      );
    } else {
      this.logger.warn(
        ` Usuario ${toUserId} no está conectado para recibir notificación de transferencia`,
      );
    }
  }

  
  notifyTransfer(payload: {
    fromUserId: number;
    toUserId: number;
    amount: number;
    transactionId: number;
    newBalanceFrom: number;
    newBalanceTo: number;
    timestamp: Date;
  }) {
    this.notifyTransferSent(payload.fromUserId, {
      transactionId: payload.transactionId,
      amount: payload.amount,
      toEmail: 'usuario',
      newBalance: payload.newBalanceFrom,
      timestamp: payload.timestamp,
    });

    this.notifyTransferReceived(payload.toUserId, {
      transactionId: payload.transactionId,
      amount: payload.amount,
      fromEmail: 'usuario',
      newBalance: payload.newBalanceTo,
      timestamp: payload.timestamp,
    });
  }

 
  sendNotificationToUser(userId: number, eventName: string, data: any) {
    const socketId = this.connectedUsersService.getSocketId(userId);

    if (socketId) {
      this.server.to(socketId).emit(eventName, data);
      this.logger.log(
        `📨 Notificación '${eventName}' enviada al usuario ${userId}`,
      );
    } else {
      this.logger.warn(
        `⚠️ Usuario ${userId} no está conectado para recibir la notificación '${eventName}'`,
      );
    }
  }

  
  isUserConnected(userId: number): boolean {
    return this.connectedUsersService.isConnected(userId);
  }
}
