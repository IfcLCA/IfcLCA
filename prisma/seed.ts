import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Create the projects
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { name: "Green Office Tower" },
      update: {},
      create: {
        name: "Green Office Tower",
        description:
          "A 30-story office building with LEED Platinum certification goal",
      },
    }),
    prisma.project.upsert({
      where: { name: "Sustainable Housing Complex" },
      update: {},
      create: {
        name: "Sustainable Housing Complex",
        description:
          "Multi-family residential complex focusing on sustainable living",
      },
    }),
    prisma.project.upsert({
      where: { name: "Eco-Friendly School" },
      update: {},
      create: {
        name: "Eco-Friendly School",
        description:
          "Educational facility designed with environmental consciousness",
      },
    }),
  ]);

  console.log("Seeded projects:", projects);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
