import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();
    const { kbobId } = await request.json();

    const material = await Material.findByIdAndUpdate(
      params.id,
      {
        $set: {
          kbobMatchId: new mongoose.Types.ObjectId(kbobId),
        },
      },
      { new: true }
    ).populate("kbobMatchId");

    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: material._id.toString(),
      name: material.name,
      category: material.category,
      volume: material.volume,
      kbobMatch: material.kbobMatchId
        ? {
            id: material.kbobMatchId._id.toString(),
            name: material.kbobMatchId.Name,
            indicators: {
              gwp: material.kbobMatchId.GWP,
              ubp: material.kbobMatchId.UBP,
              penre: material.kbobMatchId.PENRE,
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to match material:", error);
    return NextResponse.json(
      { error: "Failed to match material" },
      { status: 500 }
    );
  }
}
