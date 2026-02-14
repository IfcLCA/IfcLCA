import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));

  return NextResponse.json({ projects: userProjects });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, preferredDataSource, classificationSystem } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const id = nanoid();

  await db.insert(projects).values({
    id,
    userId,
    name: name.trim(),
    description: description?.trim(),
    preferredDataSource: preferredDataSource ?? "kbob",
    classificationSystem: classificationSystem ?? "eBKP-H",
  });

  return NextResponse.json({ id }, { status: 201 });
}
