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

    // First, get all materials for the project with populated KBOB matches
    const materials = await mongoose.models.Material.find({ projectId: project._id })
      .populate({
        path: 'kbobMatchId',
        model: 'KBOBMaterial',
        select: 'Name Category GWP UBP PENRE kg/unit min density max density'
      })
      .lean();

    console.log("Materials with KBOB:", materials.map(m => ({ 
      id: m._id.toString(), 
      name: m.name,
      kbob: m.kbobMatchId ? { id: m.kbobMatchId._id, name: m.kbobMatchId.Name } : null
    })));
    
    // Get elements with their material references
    const elements = await mongoose.models.Element.find({ projectId: project._id })
      .populate({
        path: 'materials.material',
        model: 'Material',
        populate: {
          path: 'kbobMatchId',
          model: 'KBOBMaterial',
          select: 'Name Category GWP UBP PENRE'
        }
      })
      .lean();

    console.log("Materials in DB:", materials.map(m => ({ id: m._id.toString(), name: m.name })));
    
    // Process elements to ensure material references are properly populated
    const populatedElements = elements.map(element => {
      return {
        ...element,
        materials: element.materials.map(mat => {
          const materialRef = mat.material;
          const kbobRef = materialRef?.kbobMatchId;
          return {
            ...mat,
            material: {
              ...materialRef,
              name: materialRef?.name || 'Unknown',
              kbobMatchId: kbobRef ? {
                Name: kbobRef.Name,
                Category: kbobRef.Category,
                GWP: kbobRef.GWP,
                UBP: kbobRef.UBP,
                PENRE: kbobRef.PENRE
              } : null
            }
          };
        }).filter(mat => mat.material !== null)
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
