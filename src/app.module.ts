import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { CommentsModule } from './modules/comments/comments.module';
import { CharactersModule } from './modules/characters/characters.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { FeedModule } from './modules/feed/feed.module';
import { FollowsModule } from './modules/follows/follows.module';
import { GenresModule } from './modules/genres/genres.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { RomanceGenresModule } from './modules/romance-genres/romance-genres.module';
import { HighlightsModule } from './modules/highlights/highlights.module';
import { LibraryModule } from './modules/library/library.module';
import { NovelsModule } from './modules/novels/novels.module';
import { PostsModule } from './modules/posts/posts.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ReaderModule } from './modules/reader/reader.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { ReadingListsModule } from './modules/reading-lists/reading-lists.module';
import { SearchModule } from './modules/search/search.module';
import { UsersModule } from './modules/users/users.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { PlannerModule } from './modules/planner/planner.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ForumModule } from './modules/forum/forum.module';
import { WorldbuildingModule } from './modules/worldbuilding/worldbuilding.module';
import { MapsModule } from './modules/maps/maps.module';
import { WorldsModule } from './modules/worlds/worlds.module';
import { ExportsModule } from './modules/exports/exports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { VotesModule } from './modules/votes/votes.module';
import { KudosModule } from './modules/kudos/kudos.module';
import { SeriesModule } from './modules/series/series.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { CommunityForumsModule } from './modules/community-forums/community-forums.module';
import { CommunityCharactersModule } from './modules/community-characters/community-characters.module';
import { MediaModule } from './modules/media/media.module';
import { VisualBoardsModule } from './modules/visual-boards/visual-boards.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    FollowsModule,
    PostsModule,
    CommentsModule,
    ReactionsModule,
    FeedModule,
    SearchModule,
    DiscoveryModule,
    GenresModule,
    LanguagesModule,
    RomanceGenresModule,
    NovelsModule,
    ChaptersModule,
    WorldsModule,
    WorldbuildingModule,
    CharactersModule,
    ReaderModule,
    BookmarksModule,
    HighlightsModule,
    ReadingListsModule,
    LibraryModule,
    TimelineModule,
    PlannerModule,
    NotificationsModule,
    SettingsModule,
    ForumModule,
    ExportsModule,
    MapsModule,
    AnalyticsModule,
    VotesModule,
    KudosModule,
    SeriesModule,
    CommunitiesModule,
    CommunityForumsModule,
    CommunityCharactersModule,
    MediaModule,
    VisualBoardsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
