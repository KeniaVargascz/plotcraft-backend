import { Body, Controller, Get, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SettingsService } from './settings.service';
import { UpdatePrivacySettingsDto } from './dto/privacy-settings.dto';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('privacy')
  @ApiOperation({ summary: 'Get privacy settings' })
  getPrivacy(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getPrivacy(user.sub);
  }

  @Patch('privacy')
  @ApiOperation({ summary: 'Update privacy settings' })
  updatePrivacy(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePrivacySettingsDto,
  ) {
    return this.settingsService.updatePrivacy(user.sub, dto);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification preferences' })
  getNotificationPreferences(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getNotificationPreferences(user.sub);
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.settingsService.updateNotificationPreferences(user.sub, dto);
  }

  @Post('export')
  @ApiOperation({ summary: 'Export all user data as JSON file' })
  async exportData(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const data = await this.settingsService.exportData(user.sub);
    const filename = `plotcraft-data-${user.username}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
