import { Injectable, Logger } from '@nestjs/common';


export interface ConnectedUser {
  userId: number;
  socketId: string;
  email: string;
  connectedAt: Date;
}


@Injectable()
export class ConnectedUsersService {
  private readonly logger = new Logger(ConnectedUsersService.name);
  private readonly connectedUsers = new Map<number, ConnectedUser>();  
  private readonly socketToUserId = new Map<string, number>();

  registerConnection(
    userId: number,
    socketId: string,
    email: string,
  ): ConnectedUser {
    
    if (this.connectedUsers.has(userId)) {
      this.logger.warn(
        `Usuario ${userId} ya estaba conectado. Reemplazando conexión anterior.`,
      );
      const oldConnection = this.connectedUsers.get(userId);
      if (oldConnection) {
        this.socketToUserId.delete(oldConnection.socketId);
      }
    }

     const connectedUser: ConnectedUser = {
      userId,
      socketId,
      email,
      connectedAt: new Date(),
    };

   
    this.connectedUsers.set(userId, connectedUser);
    this.socketToUserId.set(socketId, userId);

    this.logger.log(
      ` Usuario conectado: ${email} (ID: ${userId}, Socket: ${socketId})`,
    );

    return connectedUser;
  }

  
  disconnectUser(userId: number): boolean {
    const user = this.connectedUsers.get(userId);

    if (!user) {
      return false;
    }

    
    this.connectedUsers.delete(userId);
    this.socketToUserId.delete(user.socketId);

    this.logger.log(` Usuario desconectado: ID ${userId} (${user.email})`);

    return true;
  }

 
  disconnectBySocket(socketId: string): boolean {
    const userId = this.socketToUserId.get(socketId);

    if (!userId) {
      return false;
    }

    return this.disconnectUser(userId);
  }

 
  isConnected(userId: number): boolean {
    return this.connectedUsers.has(userId);
  }

  
  getSocketId(userId: number): string | undefined {
    return this.connectedUsers.get(userId)?.socketId;
  }

  
  getUserIdBySocket(socketId: string): number | undefined {
    return this.socketToUserId.get(socketId);
  }

  
  getConnectionInfo(userId: number): ConnectedUser | undefined {
    return this.connectedUsers.get(userId);
  }

 
  getAllConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  
  getTotalConnected(): number {
    return this.connectedUsers.size;
  }

  
  
  clearAllConnections(): void {
    this.connectedUsers.clear();
    this.socketToUserId.clear();
    this.logger.log(' Todas las conexiones han sido limpiadas');
  }

 
  
}
