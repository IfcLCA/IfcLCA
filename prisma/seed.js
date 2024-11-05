const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Create a sample project
  const project = await prisma.project.create({
    data: {
      name: "Sample Project",
      description: "A sample project for testing",
    },
  });

  console.log("Seed data created:", { project });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
