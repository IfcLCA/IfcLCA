import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    const projects = await Project.find({ userId }).lean();

    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const uploadsCount = await mongoose.models.Upload.countDocuments({
          projectId: project._id,
        });
        const elementsCount = await mongoose.models.Element.countDocuments({
          projectId: project._id,
        });

        return {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          phase: project.phase,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          _count: {
            uploads: uploadsCount,
            elements: elementsCount,
          },
        };
      })
    );

    return NextResponse.json(projectsWithCounts);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await connectToDatabase();

    const project = await Project.create({
      ...body,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
