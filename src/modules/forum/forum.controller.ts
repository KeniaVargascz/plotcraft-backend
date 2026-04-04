import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ForumReactionDto } from './dto/forum-reaction.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { ForumService } from './forum.service';

@ApiTags('forum')
@Controller('forum')
export class ForumController {
  constructor(
    private readonly forumService: ForumService,
    private readonly authService: AuthService,
  ) {}

  // ── Public Endpoints (with optional auth) ──

  @Public()
  @Get()
  @ApiOperation({ summary: 'List forum threads' })
  async listThreads(
    @Query() query: ThreadQueryDto,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);

    return this.forumService.listThreads(query, viewer?.sub ?? null);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List forum categories with thread counts' })
  getCategories() {
    return this.forumService.getCategories();
  }

  @Public()
  @Get('user/:username')
  @ApiOperation({ summary: 'List threads by user' })
  listUserThreads(@Param('username') username: string) {
    return this.forumService.listUserThreads(username);
  }

  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({ summary: 'List my threads including archived' })
  listMyThreads(@CurrentUser() user: JwtPayload) {
    return this.forumService.listMyThreads(user.sub);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get thread detail' })
  async getThread(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.authService.getOptionalJwtPayloadFromAuthHeader(authorization);

    return this.forumService.getThread(slug, viewer?.sub ?? null);
  }

  // ── Protected Endpoints ──

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new thread' })
  createThread(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateThreadDto,
  ) {
    return this.forumService.createThread(user.sub, dto);
  }

  @ApiBearerAuth()
  @Patch(':slug')
  @ApiOperation({ summary: 'Update own thread' })
  updateThread(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.forumService.updateThread(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug')
  @ApiOperation({ summary: 'Soft-delete own thread' })
  deleteThread(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.deleteThread(slug, user.sub);
  }

  // ── Reply Endpoints ──

  @ApiBearerAuth()
  @Post(':slug/replies')
  @ApiOperation({ summary: 'Reply to a thread' })
  createReply(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReplyDto,
  ) {
    return this.forumService.createReply(slug, user.sub, dto);
  }

  // ── Reply Reaction (must be before PATCH/DELETE :slug/replies/:id) ──

  @ApiBearerAuth()
  @Post(':slug/replies/:id/reactions')
  @ApiOperation({ summary: 'Toggle reaction on a reply' })
  toggleReplyReaction(
    @Param('slug') slug: string,
    @Param('id') replyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ForumReactionDto,
  ) {
    return this.forumService.toggleReplyReaction(slug, replyId, user.sub, dto);
  }

  // ── Solution (must be before PATCH :slug/replies/:id) ──

  @ApiBearerAuth()
  @Post(':slug/replies/:id/solution')
  @ApiOperation({ summary: 'Mark reply as solution' })
  markSolution(
    @Param('slug') slug: string,
    @Param('id') replyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.markSolution(slug, replyId, user.sub);
  }

  @ApiBearerAuth()
  @Delete(':slug/replies/:id/solution')
  @ApiOperation({ summary: 'Unmark reply as solution' })
  unmarkSolution(
    @Param('slug') slug: string,
    @Param('id') replyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.unmarkSolution(slug, replyId, user.sub);
  }

  @ApiBearerAuth()
  @Patch(':slug/replies/:id')
  @ApiOperation({ summary: 'Update own reply' })
  updateReply(
    @Param('slug') slug: string,
    @Param('id') replyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateReplyDto,
  ) {
    return this.forumService.updateReply(slug, replyId, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug/replies/:id')
  @ApiOperation({ summary: 'Soft-delete own reply' })
  deleteReply(
    @Param('slug') slug: string,
    @Param('id') replyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.deleteReply(slug, replyId, user.sub);
  }

  // ── Thread Reaction ──

  @ApiBearerAuth()
  @Post(':slug/reactions')
  @ApiOperation({ summary: 'Toggle reaction on a thread' })
  toggleThreadReaction(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ForumReactionDto,
  ) {
    return this.forumService.toggleThreadReaction(slug, user.sub, dto);
  }

  // ── Poll Endpoints ──

  @ApiBearerAuth()
  @Post(':slug/vote')
  @ApiOperation({ summary: 'Vote on a thread poll' })
  votePoll(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: VotePollDto,
  ) {
    return this.forumService.votePoll(slug, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':slug/vote')
  @ApiOperation({ summary: 'Remove poll vote' })
  removeVote(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.removeVote(slug, user.sub);
  }

  // ── Moderation Endpoints ──

  @ApiBearerAuth()
  @Post(':slug/close')
  @ApiOperation({ summary: 'Close own thread' })
  closeThread(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.closeThread(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':slug/open')
  @ApiOperation({ summary: 'Reopen own thread' })
  openThread(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.forumService.openThread(slug, user.sub);
  }

  @ApiBearerAuth()
  @Post(':slug/pin')
  @ApiOperation({ summary: 'Pin thread (admin only)' })
  pinThread(@Param('slug') slug: string) {
    return this.forumService.pinThread(slug);
  }

  @ApiBearerAuth()
  @Post(':slug/unpin')
  @ApiOperation({ summary: 'Unpin thread (admin only)' })
  unpinThread(@Param('slug') slug: string) {
    return this.forumService.unpinThread(slug);
  }

  @ApiBearerAuth()
  @Post(':slug/archive')
  @ApiOperation({ summary: 'Archive thread (author or admin)' })
  archiveThread(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    return this.forumService.archiveThread(slug, user.sub);
  }
}
