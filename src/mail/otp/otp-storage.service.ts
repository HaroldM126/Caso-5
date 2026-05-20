import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OtpStorageService {
  private readonly logger = new Logger(OtpStorageService.name);
  // Almacén en memoria: clave email → valor { código, ID del temporizador }
  private otps = new Map<string, { code: string; timeoutId: NodeJS.Timeout }>();

  saveOtp(email: string, code: string, ttlMs: number) {
    // Si ya existe un código OTP previo, cancelamos su temporizador para evitar fugas de memoria
    const existing = this.otps.get(email);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    // Configuramos un nuevo setTimeout para eliminar el código una vez expirado el TTL (ej: 5 minutos)
    const timeoutId = setTimeout(() => {
      this.otps.delete(email);
      this.logger.debug(`Código OTP para ${email} ha expirado y fue eliminado automáticamente.`);
    }, ttlMs);

    this.otps.set(email, { code, timeoutId });
  }

  // Verifica el código OTP del usuario
  verifyOtp(email: string, code: string): boolean {
    const entry = this.otps.get(email);
    if (!entry) {
      return false;
    }

    // Si coincide, lo removemos y limpiamos el timer
    if (entry.code === code) {
      this.deleteOtp(email);
      return true;
    }

    return false;
  }

  // Elimina manualmente el registro y cancela el temporizador
  deleteOtp(email: string) {
    const entry = this.otps.get(email);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.otps.delete(email);
    }
  }
}
