import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mappings = await request.json();
    if (!Array.isArray(mappings)) {
      return NextResponse.json({ error: "Invalid mappings" }, { status: 400 });
    }

    await connectToDatabase();
    const projects = await Project.find({ userId }).select("_id").lean();
    const projectIds = projects.map((p) => p._id);

    for (const m of mappings) {
      if (!m.materialName || !m.kbobMatchId) continue;
      const kbobId = new mongoose.Types.ObjectId(m.kbobMatchId);
      await Material.updateMany(
        { name: m.materialName, projectId: { $in: projectIds } },
        { kbobMatchId: kbobId, ...(m.density ? { density: m.density } : {}) }
      );
    }

    return NextResponse.json({ message: "Mappings imported" });
  } catch (error) {
    console.error("Failed to import mappings:", error);
    return NextResponse.json({ error: "Failed to import mappings" }, { status: 500 });
  }
}
