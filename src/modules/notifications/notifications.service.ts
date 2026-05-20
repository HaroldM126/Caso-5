import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Notification } from '../../entities/notification/notification.entity';
import { User } from '../../entities/user/user.entity';
import { BankOperationEvent } from '../../events/bank-operation.event';
import { GetNotificationsQueryDto } from './dtos/get-notifications.query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createFromEvent(event: BankOperationEvent): Promise<Notification> {
    const user = await this.userRepository.findOne({ where: { id: event.userId } });
    if (!user) {
      throw new NotFoundException(`Usuario ${event.userId} no encontrado para notificación`);
    }

    const notification = this.notificationRepository.create({
      type: event.operationType,
      status: event.operationStatus,
      amount: Number(event.amount),
      fromAccountId: event.fromAccountId,
      toAccountId: event.toAccountId,
      transactionId: event.transactionId,
      message: event.message,
      payload: event.details,
      user,
      read: false,
    });

    return this.notificationRepository.save(notification);
  }

  private buildQuery(userId: number, isAdmin: boolean, filters: GetNotificationsQueryDto) {
    let query: SelectQueryBuilder<Notification> = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user');

    if (!isAdmin) {
      query = query.where('notification.user_id = :userId', { userId });
    }

    if (filters.type) {
      query = query.andWhere('notification.type = :type', { type: filters.type });
    }

    if (filters.status) {
      query = query.andWhere('notification.status = :status', { status: filters.status });
    }

    if (filters.read !== undefined) {
      query = query.andWhere('notification.read = :read', { read: filters.read });
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    query = query.orderBy('notification.created_at', 'DESC');
    query = query.skip((page - 1) * limit).take(limit);

    return query;
  }

  async findNotifications(userId: number, isAdmin: boolean, filters: GetNotificationsQueryDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const query = this.buildQuery(userId, isAdmin, filters);
    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findNotificationById(notificationId: number) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException(`Notificación ${notificationId} no encontrada`);
    }

    return notification;
  }

  async markAsRead(notificationId: number, userId: number, isAdmin: boolean, read: boolean) {
    const notification = await this.findNotificationById(notificationId);

    if (!isAdmin && notification.user.id !== userId) {
      throw new NotFoundException(`Notificación ${notificationId} no pertenece al usuario`);
    }

    notification.read = read;
    return this.notificationRepository.save(notification);
  }
}
