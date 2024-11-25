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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch project", details: error instanceof Error ? error.message : String(error) },
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
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

    // Start a session for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify project exists and belongs to user
      const project = await Project.findOne({
        _id: params.id,
        userId,
      }).session(session);

      if (!project) {
        await session.abortTransaction();
        return new Response("Project not found", { status: 404 });
      }

      // Delete all associated data in order
      await Upload.deleteMany({ projectId: params.id }).session(session);
      await Element.deleteMany({ projectId: params.id }).session(session);
      await Material.deleteMany({ projectId: params.id }).session(session);

      // Finally delete the project
      await Project.deleteOne({ _id: params.id }).session(session);

      // Commit the transaction
      await session.commitTransaction();
      return new Response(null, { status: 204 });
    } catch (error) {
      // If any error occurs, abort the transaction
      await session.abortTransaction();
      console.error("Failed to delete project:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Failed to delete project:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json(
      { error: "Failed to update project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
