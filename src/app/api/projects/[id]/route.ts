import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material } from "@/models";
import mongoose from "mongoose";

interface ProjectDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  phase?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UploadDoc {
  _id: mongoose.Types.ObjectId;
  filename: string;
  status: string;
  elementCount: number;
  createdAt: Date;
}

interface ElementDoc {
  _id: mongoose.Types.ObjectId;
  guid: string;
  name: string;
  type?: string;
  volume?: number;
  buildingStorey?: string;
}

interface MaterialDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  category?: string;
  volume?: number;
  fraction?: number;
}

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const project = (await Project.findById(params.id).lean()) as ProjectDoc;
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const uploads = (await Upload.find({
      projectId: new mongoose.Types.ObjectId(params.id),
      deleted: false,
    }).lean()) as UploadDoc[];

    const elements = (await Element.find({
      projectId: new mongoose.Types.ObjectId(params.id),
    }).lean()) as ElementDoc[];

    const materials = (await Material.aggregate([
      {
        $match: {
          projects: new mongoose.Types.ObjectId(params.id),
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          category: 1,
          volume: 1,
          fraction: 1,
        },
      },
    ])) as MaterialDoc[];

    const processedMaterials = materials.map((m: MaterialDoc) => ({
      id: m._id.toString(),
      name: m.name,
      category: m.category,
      volume: m.volume,
      fraction: m.fraction,
    }));

    return NextResponse.json({
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      phase: project.phase,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      uploads: uploads.map((upload) => ({
        id: upload._id.toString(),
        filename: upload.filename,
        status: upload.status,
        elementCount: upload.elementCount,
        createdAt: upload.createdAt,
      })),
      elements: elements.map((element) => ({
        id: element._id.toString(),
        guid: element.guid,
        name: element.name,
        type: element.type,
        volume: element.volume,
        buildingStorey: element.buildingStorey,
      })),
      materials: processedMaterials,
      _count: {
        uploads: uploads.length,
        elements: elements.length,
        materials: materials.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const { name, description } = await request.json();

    const project = await Project.findByIdAndUpdate(
      params.id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      { new: true }
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    await Promise.all([
      Element.deleteMany({ projectId: params.id }),
      Upload.deleteMany({ projectId: params.id }),
      Project.findByIdAndDelete(params.id),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
