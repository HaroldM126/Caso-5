import { OperationType } from './operation-type.enum';
import { OperationStatus } from './operation-status.enum';

export const BANK_OPERATION_EVENT = 'bank.operation';

export interface BankOperationEvent {
  userId: number;
  operationType: OperationType;
  operationStatus: OperationStatus;
  amount: number;
  fromAccountId?: number;
  toAccountId?: number;
  transactionId?: number;
  initiatedById?: number;
  message: string;
  occurredAt: string;
  details?: Record<string, any>;
}
