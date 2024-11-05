import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

export const runtime = "edge";

async function getPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_PRISMA_URL,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter });
}

export async function GET() {
  const prisma = await getPrismaClient();

  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            uploads: true,
            elements: true,
          },
        },
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  const prisma = await getPrismaClient();

  try {
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create project:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
