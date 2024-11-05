const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Create a test project
  const project = await prisma.project.create({
    data: {
      name: "Test Project",
      description: "A test project for development",
    },
  });

  console.log("Created project:", project);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
