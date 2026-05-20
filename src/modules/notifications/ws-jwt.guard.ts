import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';


@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    try {
      
      const token =
        this.extractTokenFromSocket(client) ||
        client.handshake.auth.token ||
        client.handshake.query.token;

      if (!token) {
        this.logger.warn(
          ` Conexión rechazada - No se proporcionó token JWT (Socket: ${client.id})`,
        );
        client.disconnect(true);
        return false;
      }

      // Validar y decodificar el JWT
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const decoded = this.jwtService.verify(token, { secret: jwtSecret });

      
      client.data.user = decoded;
      client.data.userId = decoded.sub;
      client.data.email = decoded.email;

      this.logger.log(
        ` JWT validado correctamente para usuario ID: ${decoded.sub}`,
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';

      this.logger.warn(
        ` Validación JWT fallida (Socket: ${client.id}) - ${errorMessage}`,
      );

      
      client.disconnect(true);
      return false;
    }
  }

  
  private extractTokenFromSocket(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;

    if (!authHeader) {
      return undefined;
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }

    return undefined;
  }
}
