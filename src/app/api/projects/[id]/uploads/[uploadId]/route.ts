import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload, Element, Project } from "@/models";
import { MaterialService } from "@/lib/services/material-service";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; uploadId: string } },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !mongoose.Types.ObjectId.isValid(params.id) ||
      !mongoose.Types.ObjectId.isValid(params.uploadId)
    ) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await connectToDatabase();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const upload = await Upload.findOne({
        _id: params.uploadId,
        projectId: params.id,
        userId,
      }).session(session);

      if (!upload) {
        await session.abortTransaction();
        return NextResponse.json(
          { error: "Upload not found" },
          { status: 404 },
        );
      }

      await Element.deleteMany({
        projectId: params.id,
        uploadId: params.uploadId,
      }).session(session);

      const totals = await MaterialService.updateProjectEmissions(
        params.id,
        session,
      );

      await Project.updateOne(
        { _id: params.id },
        {
          $set: {
            emissions: {
              gwp: totals.totalGWP,
              ubp: totals.totalUBP,
              penre: totals.totalPENRE,
              lastCalculated: new Date(),
            },
          },
        },
      ).session(session);

      await Upload.deleteOne({ _id: params.uploadId }).session(session);

      await session.commitTransaction();
      return NextResponse.json({ success: true });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Failed to delete upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 },
    );
  }
}
