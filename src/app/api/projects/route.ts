import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();

    const projects = await Project.find().lean();

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
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const project = await Project.create({
      name,
      description,
    });

    return NextResponse.json(
      {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
