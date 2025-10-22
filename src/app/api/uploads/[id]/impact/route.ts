import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Upload, Element, Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();

        const uploadId = params.id;

        // Find upload
        const upload = await Upload.findById(uploadId);
        if (!upload) {
            return NextResponse.json({ error: "Upload not found" }, { status: 404 });
        }

        // Verify project belongs to user
        const project = await Project.findById(upload.projectId);
        if (!project || project.userId !== userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Convert uploadId to ObjectId for proper querying
        const uploadObjectId = new mongoose.Types.ObjectId(uploadId);

        // Count elements that will be deleted
        // Note: Elements are upserted by guid, so some may not have uploadId
        let elementCount = await Element.countDocuments({ uploadId: uploadObjectId });
        let elementsToDelete = await Element.find({ uploadId: uploadObjectId }).select("materials.material").lean();

        // If no elements found by uploadId, try finding by created time
        if (elementCount === 0) {
            const uploadCreatedAt = upload.createdAt;
            const uploadCreatedPlus5Min = new Date(uploadCreatedAt.getTime() + 5 * 60 * 1000); // 5 min window

            elementCount = await Element.countDocuments({
                projectId: upload.projectId,
                createdAt: {
                    $gte: uploadCreatedAt,
                    $lte: uploadCreatedPlus5Min
                }
            });

            elementsToDelete = await Element.find({
                projectId: upload.projectId,
                createdAt: {
                    $gte: uploadCreatedAt,
                    $lte: uploadCreatedPlus5Min
                }
            }).select("materials.material").lean();
        }
        const materialsToDeleteIds = new Set(
            elementsToDelete.flatMap((el) => el.materials.map((m: any) => m.material.toString()))
        );

        // Check which materials will become orphaned (volume becomes 0)
        const materialsToDelete = await Material.find({
            _id: { $in: Array.from(materialsToDeleteIds).map((id) => new mongoose.Types.ObjectId(id)) },
            projectId: upload.projectId,
        }).select("name _id").lean();

        return NextResponse.json({
            upload: {
                id: upload._id,
                filename: upload.filename,
                createdAt: upload.createdAt,
                elementCount: upload.elementCount,
            },
            impact: {
                elementsToDelete: elementCount,
                materialsToDelete: materialsToDelete.length,
                materialNames: materialsToDelete.map((m) => m.name),
            },
        });
    } catch (error) {
        console.error("Failed to get upload impact:", error);
        return NextResponse.json(
            { error: "Failed to get upload impact" },
            { status: 500 }
        );
    }
}

