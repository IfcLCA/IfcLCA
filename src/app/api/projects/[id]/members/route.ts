import { connectToDatabase } from "@/lib/mongodb";
import { Project, ProjectMembership } from "@/models";
import { userHasPaidPlan } from "@/lib/services/billing-service";
import { auth, clerkClient } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    await connectToDatabase();

    const projectId = new mongoose.Types.ObjectId(params.id);

    const project = await Project.findById(projectId).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.userId === userId;
    if (!isOwner) {
      const membership = await ProjectMembership.findOne({
        projectId,
        userId,
        status: "accepted",
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const memberships = await ProjectMembership.find({ projectId }).lean();

    const accepted: any[] = [];
    const pending: any[] = [];

    for (const m of memberships) {
      let user = null;
      try {
        user = await clerkClient.users.getUser(m.userId);
      } catch {
        // ignore errors fetching user info
      }
      const data = {
        id: m._id.toString(),
        userId: m.userId,
        role: m.role,
        status: m.status,
        user: user
          ? {
              id: user.id,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
              imageUrl: user.imageUrl,
            }
          : null,
      };
      if (m.status === "accepted") {
        accepted.push(data);
      } else {
        pending.push(data);
      }
    }

    return NextResponse.json({ accepted, pending });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const invitedUserId = body.userId;
    const role = body.role || "member";
    if (!invitedUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    await connectToDatabase();
    const projectId = new mongoose.Types.ObjectId(params.id);

    const project = await Project.findById(projectId).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hasPlan = await userHasPaidPlan(userId);
    if (!hasPlan) {
      return NextResponse.json(
        { error: "Paid plan required" },
        { status: 402 }
      );
    }

    const existing = await ProjectMembership.findOne({
      projectId,
      userId: invitedUserId,
    });
    if (existing) {
      return NextResponse.json({ error: "Already invited" }, { status: 400 });
    }

    const membership = await ProjectMembership.create({
      projectId,
      userId: invitedUserId,
      role,
      status: "pending",
    });

    return NextResponse.json({ id: membership._id.toString() });
  } catch (error) {
    console.error("Failed to invite member:", error);
    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}
