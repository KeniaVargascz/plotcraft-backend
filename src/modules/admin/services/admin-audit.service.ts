import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AuditLogEntry {
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

interface AuditQuery {
  page: number;
  limit: number;
  action?: string;
  resourceType?: string;
  adminId?: string;
}

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry) {
    return this.logWithClient(this.prisma, entry);
  }

  async logWithTx(tx: PrismaTransactionClient, entry: AuditLogEntry) {
    return this.logWithClient(tx, entry);
  }

  private async logWithClient(
    client: PrismaTransactionClient,
    entry: AuditLogEntry,
  ) {
    return client.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        adminEmail: entry.adminEmail,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: (entry.details as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async findAll(query: AuditQuery) {
    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.adminId) where.adminId = query.adminId;

    const [data, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasMore: query.page * query.limit < total,
      },
    };
  }
}
