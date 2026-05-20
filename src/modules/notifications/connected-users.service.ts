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
  
  // Maps userId to a Set of active socketIds
  private readonly connectedUsers = new Map<number, Set<string>>();  
  
  // Maps socketId to connection information
  private readonly socketToUserInfo = new Map<string, { userId: number; email: string; connectedAt: Date }>();

  registerConnection(
    userId: number,
    socketId: string,
    email: string,
  ): ConnectedUser {
    let socketSet = this.connectedUsers.get(userId);
    if (!socketSet) {
      socketSet = new Set<string>();
      this.connectedUsers.set(userId, socketSet);
    }
    socketSet.add(socketId);

    const connectedAt = new Date();
    this.socketToUserInfo.set(socketId, {
      userId,
      email,
      connectedAt,
    });

    this.logger.log(
      `🔌 Usuario registrado (multi-device): ${email} (ID: ${userId}, Socket: ${socketId}, Total Sockets: ${socketSet.size})`,
    );

    return {
      userId,
      socketId,
      email,
      connectedAt,
    };
  }

  disconnectUser(userId: number): boolean {
    const socketSet = this.connectedUsers.get(userId);
    if (!socketSet) {
      return false;
    }

    for (const socketId of socketSet) {
      this.socketToUserInfo.delete(socketId);
    }
    this.connectedUsers.delete(userId);

    this.logger.log(`🔌 Usuario desconectado por ID: ${userId} (Limpiados todos sus sockets)`);
    return true;
  }

  disconnectBySocket(socketId: string): boolean {
    const userInfo = this.socketToUserInfo.get(socketId);
    if (!userInfo) {
      return false;
    }

    const { userId, email } = userInfo;
    this.socketToUserInfo.delete(socketId);

    const socketSet = this.connectedUsers.get(userId);
    if (socketSet) {
      socketSet.delete(socketId);
      if (socketSet.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    this.logger.log(
      `🔌 Socket desconectado: ${socketId} del usuario ID: ${userId} (${email})`,
    );
    return true;
  }

  isConnected(userId: number): boolean {
    const socketSet = this.connectedUsers.get(userId);
    return !!socketSet && socketSet.size > 0;
  }

  getSocketId(userId: number): string | undefined {
    const socketSet = this.connectedUsers.get(userId);
    if (!socketSet || socketSet.size === 0) {
      return undefined;
    }
    return Array.from(socketSet)[0];
  }

  getSocketIds(userId: number): string[] {
    const socketSet = this.connectedUsers.get(userId);
    return socketSet ? Array.from(socketSet) : [];
  }

  getUserIdBySocket(socketId: string): number | undefined {
    return this.socketToUserInfo.get(socketId)?.userId;
  }

  getConnectionInfo(userId: number): ConnectedUser | undefined {
    const socketSet = this.connectedUsers.get(userId);
    if (!socketSet || socketSet.size === 0) {
      return undefined;
    }
    const firstSocketId = Array.from(socketSet)[0];
    const info = this.socketToUserInfo.get(firstSocketId);
    if (!info) return undefined;
    return {
      userId,
      socketId: firstSocketId,
      email: info.email,
      connectedAt: info.connectedAt,
    };
  }

  getAllConnectedUsers(): ConnectedUser[] {
    const list: ConnectedUser[] = [];
    this.socketToUserInfo.forEach((info, socketId) => {
      list.push({
        userId: info.userId,
        socketId,
        email: info.email,
        connectedAt: info.connectedAt,
      });
    });
    return list;
  }

  getTotalConnected(): number {
    return this.connectedUsers.size;
  }

  clearAllConnections(): void {
    this.connectedUsers.clear();
    this.socketToUserInfo.clear();
    this.logger.log('🧹 Todas las conexiones han sido limpiadas');
  }
}

