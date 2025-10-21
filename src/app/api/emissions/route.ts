import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Sum pre-calculated emissions from all active projects
    const projects = await Project.aggregate([
      {
        $match: {
          userId,
          isArchived: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          gwp: { $sum: { $ifNull: ["$emissions.gwp", 0] } },
          ubp: { $sum: { $ifNull: ["$emissions.ubp", 0] } },
          penre: { $sum: { $ifNull: ["$emissions.penre", 0] } },
          projectCount: { $sum: 1 },
          projectNames: { $push: "$name" },
        },
      },
    ]).exec();

    // If no projects or materials found, return zeros
    const totalEmissions = projects[0] || {
      gwp: 0,
      ubp: 0,
      penre: 0,
    };

    return NextResponse.json(totalEmissions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to calculate emissions" },
      { status: 500 }
    );
  }
}
