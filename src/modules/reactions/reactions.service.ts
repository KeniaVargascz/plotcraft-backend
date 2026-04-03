import { Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async toggleReaction(postId: string, userId: string, dto: ToggleReactionDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Publicacion no encontrada');
    }

    const reactionType = dto.reactionType ?? ReactionType.LIKE;
    const existing = await this.prisma.reaction.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    let reacted = true;
    let finalReactionType: ReactionType | null = reactionType;

    if (!existing) {
      await this.prisma.reaction.create({
        data: {
          postId,
          userId,
          reactionType,
        },
      });

      if (post.authorId !== userId) {
        void this.notificationsService.createNotification({
          userId: post.authorId,
          type: 'NEW_REACTION' as any,
          title: `Alguien reacciono a tu publicacion`,
          body: `Nueva reaccion`,
          url: `/feed`,
          actorId: userId,
        });
      }
    } else if (existing.reactionType === reactionType) {
      await this.prisma.reaction.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });
      reacted = false;
      finalReactionType = null;
    } else {
      await this.prisma.reaction.update({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
        data: {
          reactionType,
        },
      });
    }

    const newCount = await this.prisma.reaction.count({
      where: { postId },
    });

    return {
      reacted,
      reactionType: finalReactionType,
      newCount,
    };
  }
}
