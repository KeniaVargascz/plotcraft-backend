import { PrismaClient } from '@prisma/client';
import { seed00Languages } from './00-languages.seed';
import { seed00Genres } from './00-genres.seed';
import { seed01Users } from './01-users.seed';
import { seed02Profiles } from './02-profiles.seed';
import { seed03PrivacySettings } from './03-privacy-settings.seed';
import { seed04Novels } from './04-novels.seed';
import { seed05Chapters } from './05-chapters.seed';
import { seed06ReaderData } from './06-reader-data.seed';
import { seed07Social } from './07-social.seed';
import { seed08Worlds } from './08-worlds.seed';
import { seed09Characters } from './09-characters.seed';
import { seed10Worldbuilding } from './10-worldbuilding.seed';
import { seed11Timeline } from './11-timeline.seed';
import { seed12Planner } from './12-planner.seed';
import { seed13Forum } from './13-forum.seed';
import { seed14Notifications } from './14-notifications.seed';
import { seed15Maps } from './15-maps.seed';
import { seed16Analytics } from './16-analytics.seed';
import { seed17FeedV2 } from './17-feed-v2.seed';
import { seed18SeriesSubscriptions } from './18-series-subscriptions.seed';
import { seed19Communities } from './19-communities.seed';

export async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('🌱 Starting PlotCraft seed...\n');
    await seed00Languages(prisma);
    await seed00Genres(prisma);
    await seed01Users(prisma);
    await seed02Profiles(prisma);
    await seed03PrivacySettings(prisma);
    await seed04Novels(prisma);
    await seed05Chapters(prisma);
    await seed06ReaderData(prisma);
    await seed07Social(prisma);
    await seed08Worlds(prisma);
    await seed09Characters(prisma);
    await seed10Worldbuilding(prisma);
    await seed11Timeline(prisma);
    await seed12Planner(prisma);
    await seed13Forum(prisma);
    await seed14Notifications(prisma);
    await seed15Maps(prisma);
    await seed16Analytics(prisma);
    await seed17FeedV2(prisma);
    await seed18SeriesSubscriptions(prisma);
    await seed19Communities(prisma);

    console.log('\n✅ Seed completed successfully');
    console.log('\nDemo credentials:');
    console.log('  demo@plotcraft.com / Demo1234!');
    console.log('  luna@plotcraft.com / Demo1234!');
    console.log('  writer.marcos@plotcraft.com / Demo1234!');
    console.log('  reader.alex@plotcraft.com / Demo1234!');
  } finally {
    await prisma.$disconnect();
  }
}
