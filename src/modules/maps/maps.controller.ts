import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { UpdateViewportDto } from './dto/update-viewport.dto';
import { MapsService } from './maps.service';

@ApiTags('maps')
@Controller('worlds/:slug/map')
export class MapsController {
  constructor(
    private readonly mapsService: MapsService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Obtener mapa de un mundo' })
  getMap(@Param('slug') slug: string) {
    return this.mapsService.getMap(slug);
  }

  @ApiBearerAuth()
  @Patch()
  @ApiOperation({ summary: 'Actualizar configuracion del mapa' })
  updateMap(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body()
    dto: { baseImageUrl?: string; canvasWidth?: number; canvasHeight?: number },
  ) {
    return this.mapsService.updateMap(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch('viewport')
  @ApiOperation({ summary: 'Actualizar viewport del mapa' })
  updateViewport(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: UpdateViewportDto,
  ) {
    return this.mapsService.updateViewport(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Post('markers')
  @ApiOperation({ summary: 'Crear marcador en el mapa' })
  createMarker(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateMarkerDto,
  ) {
    return this.mapsService.createMarker(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch('markers/:markerId')
  @ApiOperation({ summary: 'Editar marcador del mapa' })
  updateMarker(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('markerId') markerId: string,
    @Body() dto: UpdateMarkerDto,
  ) {
    return this.mapsService.updateMarker(slug, markerId, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete('markers/:markerId')
  @ApiOperation({ summary: 'Eliminar marcador del mapa' })
  deleteMarker(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('markerId') markerId: string,
  ) {
    return this.mapsService.deleteMarker(slug, markerId, user.sub);
  }

  @ApiBearerAuth()
  @Post('regions')
  @ApiOperation({ summary: 'Crear region en el mapa' })
  createRegion(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateRegionDto,
  ) {
    return this.mapsService.createRegion(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch('regions/:regionId')
  @ApiOperation({ summary: 'Editar region del mapa' })
  updateRegion(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('regionId') regionId: string,
    @Body() dto: UpdateRegionDto,
  ) {
    return this.mapsService.updateRegion(slug, regionId, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete('regions/:regionId')
  @ApiOperation({ summary: 'Eliminar region del mapa' })
  deleteRegion(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('regionId') regionId: string,
  ) {
    return this.mapsService.deleteRegion(slug, regionId, user.sub);
  }
}
