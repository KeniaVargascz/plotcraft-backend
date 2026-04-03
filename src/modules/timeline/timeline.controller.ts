import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TimelineService } from './timeline.service';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { UpdateTimelineDto } from './dto/update-timeline.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { ReorderEventsDto } from './dto/reorder-events.dto';

@ApiTags('timelines')
@ApiBearerAuth()
@Controller('timelines')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  @ApiOperation({ summary: 'List all timelines for the current user' })
  listTimelines(@CurrentUser() user: JwtPayload) {
    return this.timelineService.listTimelines(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new timeline' })
  createTimeline(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTimelineDto,
  ) {
    return this.timelineService.createTimeline(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get timeline detail with all events' })
  getTimeline(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.timelineService.getTimeline(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a timeline' })
  updateTimeline(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTimelineDto,
  ) {
    return this.timelineService.updateTimeline(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a timeline' })
  deleteTimeline(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('confirm') confirm: boolean,
  ) {
    return this.timelineService.deleteTimeline(id, user.sub, confirm);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List events with filters' })
  listEvents(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: EventQueryDto,
  ) {
    return this.timelineService.listEvents(id, user.sub, query);
  }

  @Post(':id/events')
  @ApiOperation({ summary: 'Create a new event in the timeline' })
  createEvent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEventDto,
  ) {
    return this.timelineService.createEvent(id, user.sub, dto);
  }

  @Patch(':id/events/reorder')
  @ApiOperation({ summary: 'Reorder events in the timeline' })
  reorderEvents(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderEventsDto,
  ) {
    return this.timelineService.reorderEvents(id, user.sub, dto);
  }

  @Patch(':id/events/:eventId')
  @ApiOperation({ summary: 'Update an event' })
  updateEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEventDto,
  ) {
    return this.timelineService.updateEvent(id, eventId, user.sub, dto);
  }

  @Delete(':id/events/:eventId')
  @ApiOperation({ summary: 'Delete an event' })
  deleteEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.timelineService.deleteEvent(id, eventId, user.sub);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export timeline as JSON file' })
  async exportTimeline(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const data = await this.timelineService.exportTimeline(id, user.sub);
    const filename = `timeline-${data.timeline.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
