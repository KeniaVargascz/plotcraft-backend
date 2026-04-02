import { Injectable } from '@nestjs/common';
import { FollowsService } from '../follows/follows.service';
import { PostsService } from '../posts/posts.service';
import { FeedQueryDto } from './dto/feed-query.dto';

@Injectable()
export class FeedService {
  constructor(
    private readonly followsService: FollowsService,
    private readonly postsService: PostsService,
  ) {}

  async getPersonalizedFeed(userId: string, query: FeedQueryDto) {
    const followingIds = await this.followsService.getFollowingIds(userId);
    const authorIds = [userId, ...followingIds];

    return this.postsService.listPosts({
      query,
      viewerId: userId,
      authorIds,
    });
  }

  async getExploreFeed(query: FeedQueryDto, viewerId?: string | null) {
    return this.postsService.listPosts({
      query,
      viewerId,
    });
  }
}
