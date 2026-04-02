import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  await prisma.user.upsert({
    where: {
      email: 'demo@plotcraft.com',
    },
    update: {
      username: 'demo_writer',
      passwordHash,
      profile: {
        upsert: {
          create: {
            displayName: 'Demo Writer',
            bio: 'Cuenta de demostracion de PlotCraft',
          },
          update: {
            displayName: 'Demo Writer',
            bio: 'Cuenta de demostracion de PlotCraft',
          },
        },
      },
    },
    create: {
      email: 'demo@plotcraft.com',
      username: 'demo_writer',
      passwordHash,
      profile: {
        create: {
          displayName: 'Demo Writer',
          bio: 'Cuenta de demostracion de PlotCraft',
        },
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
