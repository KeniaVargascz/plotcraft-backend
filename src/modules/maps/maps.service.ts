import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WORLDS_SERVICE, IWorldsService } from '../worlds/worlds.interface';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { UpdateViewportDto } from './dto/update-viewport.dto';

@Injectable()
export class MapsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WORLDS_SERVICE)
    private readonly worldsService: IWorldsService,
  ) {}

  async getMap(worldSlug: string) {
    const world = await this.prisma.world.findUnique({
      where: { slug: worldSlug },
    });

    if (!world) {
      throw new NotFoundException({ statusCode: 404, message: 'World not found', code: 'WORLD_NOT_FOUND' });
    }

    const map = await this.prisma.worldMap.upsert({
      where: { worldId: world.id },
      update: {},
      create: { worldId: world.id },
      include: {
        markers: {
          include: { location: true },
          orderBy: { createdAt: 'asc' },
        },
        regions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return this.toMapResponse(map);
  }

  async updateMap(
    worldSlug: string,
    userId: string,
    dto: { baseImageUrl?: string; canvasWidth?: number; canvasHeight?: number },
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.findOrCreateMap(world.id);

    const updated = await this.prisma.worldMap.update({
      where: { id: map.id },
      data: {
        ...(dto.baseImageUrl !== undefined
          ? { baseImageUrl: dto.baseImageUrl }
          : {}),
        ...(dto.canvasWidth !== undefined
          ? { canvasWidth: dto.canvasWidth }
          : {}),
        ...(dto.canvasHeight !== undefined
          ? { canvasHeight: dto.canvasHeight }
          : {}),
      },
      include: {
        markers: {
          include: { location: true },
          orderBy: { createdAt: 'asc' },
        },
        regions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return this.toMapResponse(updated);
  }

  async updateViewport(
    worldSlug: string,
    userId: string,
    dto: UpdateViewportDto,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.findOrCreateMap(world.id);

    await this.prisma.worldMap.update({
      where: { id: map.id },
      data: {
        viewport: {
          x: dto.x,
          y: dto.y,
          zoom: dto.zoom,
        } as Prisma.InputJsonValue,
      },
    });

    return { saved: true };
  }

  async createMarker(worldSlug: string, userId: string, dto: CreateMarkerDto) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    if (dto.locationId && dto.wbEntryId) {
      throw new BadRequestException({ statusCode: 400, message: 'A marker cannot be linked to both a location and a worldbuilding entry at the same time', code: 'MARKER_DUAL_LINK' });
    }

    if (dto.locationId) {
      const location = await this.prisma.worldLocation.findFirst({
        where: { id: dto.locationId, worldId: world.id },
      });

      if (!location) {
        throw new BadRequestException({ statusCode: 400, message: 'Location not found in this world', code: 'LOCATION_NOT_FOUND_IN_WORLD' });
      }
    }

    if (dto.wbEntryId) {
      const entry = await this.prisma.wbEntry.findFirst({
        where: { id: dto.wbEntryId, worldId: world.id },
      });

      if (!entry) {
        throw new BadRequestException({ statusCode: 400, message: 'Worldbuilding entry not found in this world', code: 'WB_ENTRY_NOT_FOUND_IN_WORLD' });
      }
    }

    const map = await this.findOrCreateMap(world.id);

    const marker = await this.prisma.mapMarker.create({
      data: {
        mapId: map.id,
        label: dto.label.trim(),
        type: dto.type ?? 'CUSTOM',
        x: dto.x,
        y: dto.y,
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        color: dto.color || null,
        locationId: dto.locationId || null,
        wbEntryId: dto.wbEntryId || null,
      },
      include: { location: true },
    });

    return this.toMarkerResponse(marker);
  }

  async updateMarker(
    worldSlug: string,
    markerId: string,
    userId: string,
    dto: UpdateMarkerDto,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.prisma.worldMap.findUnique({
      where: { worldId: world.id },
    });

    if (!map) {
      throw new NotFoundException({ statusCode: 404, message: 'Map not found', code: 'MAP_NOT_FOUND' });
    }

    const marker = await this.prisma.mapMarker.findFirst({
      where: { id: markerId, mapId: map.id },
    });

    if (!marker) {
      throw new NotFoundException({ statusCode: 404, message: 'Marker not found', code: 'MARKER_NOT_FOUND' });
    }

    if (dto.locationId && dto.wbEntryId) {
      throw new BadRequestException({ statusCode: 400, message: 'A marker cannot be linked to both a location and a worldbuilding entry at the same time', code: 'MARKER_DUAL_LINK' });
    }

    if (dto.locationId) {
      const location = await this.prisma.worldLocation.findFirst({
        where: { id: dto.locationId, worldId: world.id },
      });

      if (!location) {
        throw new BadRequestException({ statusCode: 400, message: 'Location not found in this world', code: 'LOCATION_NOT_FOUND_IN_WORLD' });
      }
    }

    if (dto.wbEntryId) {
      const entry = await this.prisma.wbEntry.findFirst({
        where: { id: dto.wbEntryId, worldId: world.id },
      });

      if (!entry) {
        throw new BadRequestException({ statusCode: 400, message: 'Worldbuilding entry not found in this world', code: 'WB_ENTRY_NOT_FOUND_IN_WORLD' });
      }
    }

    const updated = await this.prisma.mapMarker.update({
      where: { id: marker.id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.x !== undefined ? { x: dto.x } : {}),
        ...(dto.y !== undefined ? { y: dto.y } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
        ...(dto.color !== undefined ? { color: dto.color || null } : {}),
        ...(dto.locationId !== undefined
          ? { locationId: dto.locationId || null }
          : {}),
        ...(dto.wbEntryId !== undefined
          ? { wbEntryId: dto.wbEntryId || null }
          : {}),
      },
      include: { location: true },
    });

    return this.toMarkerResponse(updated);
  }

  async deleteMarker(worldSlug: string, markerId: string, userId: string) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.prisma.worldMap.findUnique({
      where: { worldId: world.id },
    });

    if (!map) {
      throw new NotFoundException({ statusCode: 404, message: 'Map not found', code: 'MAP_NOT_FOUND' });
    }

    const marker = await this.prisma.mapMarker.findFirst({
      where: { id: markerId, mapId: map.id },
    });

    if (!marker) {
      throw new NotFoundException({ statusCode: 404, message: 'Marker not found', code: 'MARKER_NOT_FOUND' });
    }

    await this.prisma.mapMarker.delete({ where: { id: marker.id } });

    return { message: 'Marker deleted successfully' };
  }

  async createRegion(worldSlug: string, userId: string, dto: CreateRegionDto) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.findOrCreateMap(world.id);

    const region = await this.prisma.mapRegion.create({
      data: {
        mapId: map.id,
        label: dto.label.trim(),
        color: dto.color || undefined,
        borderColor: dto.borderColor || undefined,
        points: dto.points as unknown as Prisma.InputJsonValue,
        description: dto.description?.trim() || null,
      },
    });

    return this.toRegionResponse(region);
  }

  async updateRegion(
    worldSlug: string,
    regionId: string,
    userId: string,
    dto: UpdateRegionDto,
  ) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.prisma.worldMap.findUnique({
      where: { worldId: world.id },
    });

    if (!map) {
      throw new NotFoundException({ statusCode: 404, message: 'Map not found', code: 'MAP_NOT_FOUND' });
    }

    const region = await this.prisma.mapRegion.findFirst({
      where: { id: regionId, mapId: map.id },
    });

    if (!region) {
      throw new NotFoundException({ statusCode: 404, message: 'Region not found', code: 'REGION_NOT_FOUND' });
    }

    const updated = await this.prisma.mapRegion.update({
      where: { id: region.id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.borderColor !== undefined
          ? { borderColor: dto.borderColor }
          : {}),
        ...(dto.points !== undefined
          ? { points: dto.points as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
      },
    });

    return this.toRegionResponse(updated);
  }

  async deleteRegion(worldSlug: string, regionId: string, userId: string) {
    const world = await this.worldsService.findOwnedWorld(userId, worldSlug);

    const map = await this.prisma.worldMap.findUnique({
      where: { worldId: world.id },
    });

    if (!map) {
      throw new NotFoundException({ statusCode: 404, message: 'Map not found', code: 'MAP_NOT_FOUND' });
    }

    const region = await this.prisma.mapRegion.findFirst({
      where: { id: regionId, mapId: map.id },
    });

    if (!region) {
      throw new NotFoundException({ statusCode: 404, message: 'Region not found', code: 'REGION_NOT_FOUND' });
    }

    await this.prisma.mapRegion.delete({ where: { id: region.id } });

    return { message: 'Region deleted successfully' };
  }

  private async findOrCreateMap(worldId: string) {
    return this.prisma.worldMap.upsert({
      where: { worldId },
      update: {},
      create: { worldId },
    });
  }

  private toMapResponse(
    map: Prisma.WorldMapGetPayload<{
      include: {
        markers: { include: { location: true } };
        regions: true;
      };
    }>,
  ) {
    return {
      id: map.id,
      worldId: map.worldId,
      baseImageUrl: map.baseImageUrl,
      viewport: map.viewport,
      canvasWidth: map.canvasWidth,
      canvasHeight: map.canvasHeight,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      markers: map.markers.map((marker) => this.toMarkerResponse(marker)),
      regions: map.regions.map((region) => this.toRegionResponse(region)),
    };
  }

  private toMarkerResponse(
    marker: Prisma.MapMarkerGetPayload<{ include: { location: true } }>,
  ) {
    return {
      id: marker.id,
      mapId: marker.mapId,
      label: marker.label,
      type: marker.type,
      x: marker.x,
      y: marker.y,
      description: marker.description,
      icon: marker.icon,
      color: marker.color,
      locationId: marker.locationId,
      wbEntryId: marker.wbEntryId,
      createdAt: marker.createdAt,
      updatedAt: marker.updatedAt,
      location: marker.location
        ? {
            id: marker.location.id,
            name: marker.location.name,
            type: marker.location.type,
          }
        : null,
    };
  }

  private toRegionResponse(region: Prisma.MapRegionGetPayload<object>) {
    return {
      id: region.id,
      mapId: region.mapId,
      label: region.label,
      color: region.color,
      borderColor: region.borderColor,
      points: region.points,
      description: region.description,
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    };
  }
}
