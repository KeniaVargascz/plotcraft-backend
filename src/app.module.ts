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
import { WorldbuildingModule } from './modules/worldbuilding/worldbuilding.module';
import { WorldsModule } from './modules/worlds/worlds.module';
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
  ],
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
