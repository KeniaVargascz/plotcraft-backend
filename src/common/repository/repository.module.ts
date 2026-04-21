import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NOVEL_REPOSITORY, NovelRepository } from './implementations/novel.repository';
import { USER_REPOSITORY, UserRepository } from './implementations/user.repository';
import { NOTIFICATION_REPOSITORY, NotificationRepository } from './implementations/notification.repository';
import { CHAPTER_REPOSITORY, ChapterRepository } from './implementations/chapter.repository';
import { CHARACTER_REPOSITORY, CharacterRepository } from './implementations/character.repository';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: NOVEL_REPOSITORY, useClass: NovelRepository },
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationRepository },
    { provide: CHAPTER_REPOSITORY, useClass: ChapterRepository },
    { provide: CHARACTER_REPOSITORY, useClass: CharacterRepository },
  ],
  exports: [
    NOVEL_REPOSITORY,
    USER_REPOSITORY,
    NOTIFICATION_REPOSITORY,
    CHAPTER_REPOSITORY,
    CHARACTER_REPOSITORY,
  ],
})
export class RepositoryModule {}
