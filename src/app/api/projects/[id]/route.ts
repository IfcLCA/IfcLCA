import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const project = await Project.findById(params.id).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // First, get all materials for the project
    const materials = await mongoose.models.Material.find({ projectId: project._id })
      .populate('kbobMatchId')
      .lean();

    // Get elements with their material references
    const elements = await mongoose.models.Element.find({ projectId: project._id })
      .lean();

    console.log("Materials in DB:", materials.map(m => ({ id: m._id.toString(), name: m.name })));
    
    // Create a map of material IDs to their full objects
    const materialMap = new Map();
    materials.forEach(m => {
      materialMap.set(m._id.toString(), m);
    });

    // Manually populate material references with detailed logging
    const populatedElements = elements.map(element => {
      console.log("\nProcessing element:", element.name);
      
      return {
        ...element,
        materials: element.materials.map(mat => {
          // Convert material reference to string if it's an ObjectId
          const materialId = mat.material?.toString();
          console.log("Material reference:", materialId);
          
          // Look up material in our map
          const materialRef = materialId ? materialMap.get(materialId) : null;
          console.log("Found material:", materialRef ? materialRef.name : 'null');
          
          return {
            ...mat,
            material: materialRef // Replace reference with full material object
          };
        })
      };
    });

    const uploads = await mongoose.models.Upload.find({ projectId: project._id }).lean();

    const projectData = {
      ...project,
      uploads: uploads || [],
      elements: populatedElements || [],
      materials: materials || [],
    };

    return NextResponse.json(projectData);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const project = await Project.findOneAndUpdate(
      { _id: params.id, userId },
      { $set: body },
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
