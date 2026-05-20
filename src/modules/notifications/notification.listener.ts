import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BANK_OPERATION_EVENT } from '../../events/bank-operation.event';
import type { BankOperationEvent } from '../../events/bank-operation.event';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(BANK_OPERATION_EVENT, { async: true })
  async handleBankOperationEvent(event: BankOperationEvent) {
    try {
      await this.notificationsService.createFromEvent(event);
      this.logger.log(`Notification persisted for user ${event.userId} (${event.operationType}, ${event.operationStatus})`);
    } catch (error: any) {
      this.logger.error(`Fallo al crear notificación: ${error.message}`);
    }
  }
}
