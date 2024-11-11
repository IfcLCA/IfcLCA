import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    // Verify project ownership and get project data
    const project = await Project.findOne({
      _id: params.id,
      userId,
    }).lean();

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    // Get uploads for this project
    const uploads = await Upload.find({
      projectId: project._id,
    }).lean();

    // Get elements for this project
    const elements = await Element.find({
      projectId: project._id,
    }).lean();

    // Format the response
    const projectData = {
      _id: project._id.toString(),
      name: project.name,
      description: project.description,
      phase: project.phase,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      uploads: uploads.map((upload) => ({
        _id: upload._id.toString(),
        filename: upload.filename,
        status: upload.status,
        elementCount: upload.elementCount,
        createdAt: upload.createdAt,
      })),
      elements: elements.map((element) => ({
        _id: element._id.toString(),
        guid: element.guid,
        name: element.name,
        type: element.type,
        volume: element.volume,
        buildingStorey: element.buildingStorey,
        uploadId: element.uploadId?.toString(),
      })),
      _count: {
        uploads: uploads.length,
        elements: elements.length,
      },
    };

    return NextResponse.json(projectData);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    await connectToDatabase();

    // Verify project ownership before update
    const project = await Project.findOneAndUpdate(
      { _id: params.id, userId },
      body,
      { new: true }
    ).lean();

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    // Verify project ownership before deletion
    const project = await Project.findOneAndDelete({
      _id: params.id,
      userId,
    });

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
