import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload, Element, Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { MaterialService } from "@/lib/services/material-service";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;
    const upload = await Upload.findById(id).populate("elements");

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    return NextResponse.json(upload);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch upload status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const uploadId = id;

    // Validate ObjectId
    if (!mongoose.isValidObjectId(uploadId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Find upload and verify ownership
    const upload = await Upload.findById(uploadId);
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Verify project belongs to user
    const project = await Project.findById(upload.projectId);
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Start transaction for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.debug("Starting upload deletion", { uploadId, projectId: upload.projectId });

      // Convert uploadId to ObjectId for proper querying
      const uploadObjectId = new mongoose.Types.ObjectId(uploadId);

      // 1. Delete all elements with this uploadId
      const deleteResult = await Element.deleteMany({ uploadId: uploadObjectId }).session(session);
      logger.debug("Deleted elements by uploadId", { count: deleteResult.deletedCount });

      // 2. Recalculate material volumes from remaining elements
      const materialVolumes = await Element.aggregate([
        { $match: { projectId: upload.projectId } },
        { $unwind: "$materials" },
        {
          $group: {
            _id: "$materials.material",
            totalVolume: { $sum: "$materials.volume" },
          },
        },
      ]).session(session);

      logger.debug("Recalculated material volumes", { materialCount: materialVolumes.length });

      // Get all materials for this project to update volumes (including setting to 0 for orphaned)
      const allMaterials = await Material.find({ projectId: upload.projectId })
        .select("_id")
        .session(session)
        .lean();

      // Create a map of materials that still have volume
      const materialsWithVolume = new Map(
        materialVolumes.map((mv) => [mv._id.toString(), mv.totalVolume])
      );

      // Update all materials: set volume to 0 if no elements reference them, otherwise update to actual volume
      if (allMaterials.length > 0) {
        const materialUpdates = allMaterials.map((mat: any) => ({
          updateOne: {
            filter: { _id: mat._id },
            update: {
              $set: {
                volume: materialsWithVolume.get(mat._id.toString()) || 0
              }
            },
          },
        }));

        await Material.bulkWrite(materialUpdates, { session });
        logger.debug("Updated material volumes", { count: materialUpdates.length });
      }

      // 3. Delete orphaned materials (volume = 0)
      const orphanedResult = await Material.deleteMany({
        projectId: upload.projectId,
        volume: 0
      }).session(session);
      logger.debug("Deleted orphaned materials", { count: orphanedResult.deletedCount });

      // 4. Recalculate project emissions
      await MaterialService.updateProjectEmissions(upload.projectId.toString(), session);

      // 5. Delete the upload record
      await Upload.deleteOne({ _id: uploadId }).session(session);

      // Commit transaction
      await session.commitTransaction();

      logger.info("Upload deleted successfully", {
        uploadId,
        elementsDeleted: deleteResult.deletedCount,
        materialsDeleted: orphanedResult.deletedCount,
      });

      return NextResponse.json({
        success: true,
        elementsDeleted: deleteResult.deletedCount,
        materialsDeleted: orphanedResult.deletedCount,
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error("Error deleting upload", { error, uploadId });
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error("Failed to delete upload", { error });
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 }
    );
  }
}
