import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(private readonly gateway: NotificationsGateway) {}

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
}
