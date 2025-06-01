import { connectToDatabase } from "@/lib/mongodb";
import { Project, ProjectMembership } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !mongoose.Types.ObjectId.isValid(params.id) ||
      !mongoose.Types.ObjectId.isValid(params.memberId)
    ) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await connectToDatabase();

    const membership = await ProjectMembership.findById(params.memberId);
    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const project = await Project.findById(membership.projectId).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();

    if (body.status === "accepted") {
      if (membership.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      membership.status = "accepted";
    }

    if (body.role) {
      if (project.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      membership.role = body.role;
    }

    await membership.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !mongoose.Types.ObjectId.isValid(params.id) ||
      !mongoose.Types.ObjectId.isValid(params.memberId)
    ) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await connectToDatabase();

    const membership = await ProjectMembership.findById(params.memberId);
    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const project = await Project.findById(membership.projectId).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== userId && membership.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ProjectMembership.deleteOne({ _id: membership._id });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
