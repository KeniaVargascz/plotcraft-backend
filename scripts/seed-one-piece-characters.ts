import { PrismaClient, CommunityCharacterStatus } from '@prisma/client';

const CHARACTERS = [
  { name: 'Monkey D. Luffy', description: 'Capitán de los Sombrero de Paja.' },
  { name: 'Roronoa Zoro', description: 'Espadachín de los Sombrero de Paja.' },
  { name: 'Nami', description: 'Navegante de los Sombrero de Paja.' },
  { name: 'Usopp', description: 'Tirador de los Sombrero de Paja.' },
  { name: 'Sanji', description: 'Cocinero de los Sombrero de Paja.' },
  { name: 'Tony Tony Chopper', description: 'Médico de los Sombrero de Paja.' },
  { name: 'Nico Robin', description: 'Arqueóloga de los Sombrero de Paja.' },
  { name: 'Franky', description: 'Carpintero cyborg de los Sombrero de Paja.' },
  { name: 'Brook', description: 'Músico esqueleto de los Sombrero de Paja.' },
  { name: 'Jinbe', description: 'Timonel gyojin de los Sombrero de Paja.' },
  { name: 'Trafalgar D. Water Law', description: 'Capitán de los Heart Pirates.' },
  { name: 'Portgas D. Ace', description: 'Hermano mayor de Luffy.' },
];

async function main() {
  const p = new PrismaClient();
  try {
    const community = await p.community.findUnique({
      where: { slug: 'fandom-one-piece' },
    });
    if (!community) throw new Error('Comunidad fandom-one-piece no existe');

    let created = 0;
    for (const c of CHARACTERS) {
      const existing = await p.communityCharacter.findFirst({
        where: { communityId: community.id, name: c.name },
      });
      if (existing) continue;
      await p.communityCharacter.create({
        data: {
          communityId: community.id,
          name: c.name,
          description: c.description,
          status: CommunityCharacterStatus.ACTIVE,
        },
      });
      created++;
    }
    console.log(`OK: ${created} personajes nuevos en ${community.slug}`);
  } catch (e) {
    console.error('FAILED:', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

main();
