/**
 * Seed script — populates a handful of contacts so you can immediately
 * poke at GET-able state / run manual /identify requests against real data.
 *
 * Run with: npm run seed
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data (dev convenience only — never do this in prod).
  await prisma.contact.deleteMany();

  const doc = await prisma.contact.create({
    data: {
      email: 'doc.brown@zamazon.com',
      phoneNumber: '1000000001',
      linkPrecedence: 'primary',
    },
  });

  await prisma.contact.create({
    data: {
      email: 'emmett.brown@zamazon.com',
      phoneNumber: '1000000001',
      linkPrecedence: 'secondary',
      linkedId: doc.id,
    },
  });

  const marty = await prisma.contact.create({
    data: {
      email: 'marty.mcfly@zamazon.com',
      phoneNumber: '2000000002',
      linkPrecedence: 'primary',
    },
  });

  await prisma.contact.create({
    data: {
      email: null,
      phoneNumber: '2000000002',
      linkPrecedence: 'secondary',
      linkedId: marty.id,
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
