import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATIONS_SERVICE,
  INotificationsService,
} from '../notifications/notifications.interface';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {}

  async toggleReaction(postId: string, userId: string, dto: ToggleReactionDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException({ statusCode: 404, message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    const reactionType = dto.reactionType ?? ReactionType.LIKE;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: {
          postId_userId: { postId, userId },
        },
      });

      let reacted = true;
      let finalReactionType: ReactionType | null = reactionType;

      if (!existing) {
        await tx.reaction.create({
          data: { postId, userId, reactionType },
        });

        if (post.authorId !== userId) {
          this.notificationsService
            .createNotification({
              userId: post.authorId,
              type: 'NEW_REACTION' as any,
              title: `Alguien reacciono a tu publicacion`,
              body: `Nueva reaccion`,
              url: `/feed`,
              actorId: userId,
            })
            .catch(() => {});
        }
      } else if (existing.reactionType === reactionType) {
        await tx.reaction.delete({
          where: {
            postId_userId: { postId, userId },
          },
        });
        reacted = false;
        finalReactionType = null;
      } else {
        await tx.reaction.update({
          where: {
            postId_userId: { postId, userId },
          },
          data: { reactionType },
        });
      }

      const newCount = await tx.reaction.count({
        where: { postId },
      });

      return { reacted, reactionType: finalReactionType, newCount };
    });
  }
}
