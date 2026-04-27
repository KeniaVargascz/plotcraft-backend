import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeatureFlagCacheService } from '../../../common/services/feature-flag-cache.service';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class AdminFeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly featureFlagCache: FeatureFlagCacheService,
  ) {}

  async findAllGrouped() {
    const flags = await this.prisma.adminFeatureFlag.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    const grouped: Record<string, typeof flags> = {};
    for (const flag of flags) {
      if (!grouped[flag.group]) grouped[flag.group] = [];
      grouped[flag.group].push(flag);
    }

    return { groups: grouped, total: flags.length };
  }

  async findActive(): Promise<string[]> {
    const flags = await this.prisma.adminFeatureFlag.findMany({
      where: { enabled: true },
      select: { key: true },
    });
    return flags.map((f) => f.key);
  }

  async update(key: string, dto: UpdateFeatureFlagDto, user: JwtPayload) {
    const flag = await this.prisma.adminFeatureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException({
      statusCode: 404,
      message: `Feature flag "${key}" not found`,
      code: 'FEATURE_FLAG_NOT_FOUND',
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.adminFeatureFlag.update({
        where: { key },
        data: {
          enabled: dto.enabled,
          updatedBy: user.sub,
        },
      });

      await this.auditService.logWithTx(tx, {
        adminId: user.sub,
        adminEmail: user.email,
        action: dto.enabled ? 'FEATURE_ENABLED' : 'FEATURE_DISABLED',
        resourceType: 'feature_flag',
        resourceId: key,
        details: { previousValue: flag.enabled, newValue: dto.enabled },
      });

      return result;
    });

    await this.featureFlagCache.invalidate();
    return updated;
  }

  async toggleGroup(group: string, enabled: boolean, user: JwtPayload) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.adminFeatureFlag.updateMany({
        where: { group },
        data: { enabled, updatedBy: user.sub },
      });

      await this.auditService.logWithTx(tx, {
        adminId: user.sub,
        adminEmail: user.email,
        action: enabled ? 'GROUP_ENABLED' : 'GROUP_DISABLED',
        resourceType: 'feature_flag_group',
        resourceId: group,
        details: { affectedCount: updated.count },
      });

      return updated;
    });

    await this.featureFlagCache.invalidate();
    return { group, enabled, affectedCount: result.count };
  }
}
