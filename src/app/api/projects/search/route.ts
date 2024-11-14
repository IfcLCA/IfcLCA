import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const all = searchParams.get("all") === "true";

    await connectToDatabase();

    const queryConditions = {
      userId,
      ...(all ? {} : { name: { $regex: query, $options: "i" } }),
    };

    const projects = await Project.find(queryConditions)
      .select("name description _id")
      .sort({ name: 1 })
      .limit(all ? 10 : 5)
      .lean();

    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to search projects" },
      { status: 500 }
    );
  }
}
