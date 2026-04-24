import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async getAll() {
    const settings = await this.prisma.appSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  async update(data: Record<string, string>, admin: JwtPayload) {
    const updates: { key: string; old: string | null; new: string }[] = [];

    for (const [key, value] of Object.entries(data)) {
      const existing = await this.prisma.appSetting.findUnique({ where: { key } });
      await this.prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      updates.push({ key, old: existing?.value ?? null, new: value });
    }

    await this.auditService.log({
      adminId: admin.sub,
      adminEmail: admin.email,
      action: 'SETTINGS_UPDATED',
      resourceType: 'app_settings',
      details: { updates },
    });

    return this.getAll();
  }
}
