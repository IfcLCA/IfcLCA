import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { materialIds, kbobMaterialId } = await request.json();
    await connectToDatabase();

    const objectIds = materialIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );

    await Material.updateMany(
      { _id: { $in: objectIds } },
      { $set: { kbobMatchId: kbobMaterialId } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error matching materials:", error);
    return NextResponse.json(
      { error: "Failed to match materials" },
      { status: 500 }
    );
  }
}
