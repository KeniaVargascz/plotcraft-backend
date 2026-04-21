import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseRepository } from '../base-repository.interface';

export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';

@Injectable()
export class NotificationRepository implements BaseRepository<Notification> {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async findMany(args?: Prisma.NotificationFindManyArgs): Promise<Notification[]> {
    return this.prisma.notification.findMany(args);
  }

  async create(data: Prisma.NotificationCreateArgs): Promise<Notification> {
    return this.prisma.notification.create(data);
  }

  async update(id: string, data: Prisma.NotificationUpdateInput): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Notification> {
    return this.prisma.notification.delete({ where: { id } });
  }

  async count(args?: Prisma.NotificationCountArgs): Promise<number> {
    return this.prisma.notification.count(args);
  }

  async createMany(data: Prisma.NotificationCreateManyInput[]): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.createMany({ data });
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
