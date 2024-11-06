const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // View all projects
  const projects = await prisma.project.findMany({
    include: {
      uploads: true,
      elements: {
        include: {
          materials: true,
        },
      },
    },
  });

  console.log("Projects:", JSON.stringify(projects, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
