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

        // Validate ObjectId
        if (!mongoose.isValidObjectId(uploadId)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

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

        // Find elements that will be deleted
        const elementCount = await Element.countDocuments({ uploadId: uploadObjectId });
        const elementsToDelete = await Element.find({ uploadId: uploadObjectId })
            .select("_id materials.material")
            .lean();

        // Build set of material IDs referenced by elements to be deleted with null guards
        const elementsToDeleteIds = elementsToDelete.map((el: any) => el._id);
        const materialsReferenced = new Set<string>();
        for (const el of elementsToDelete) {
            const mats = (el as any).materials ?? [];
            for (const m of mats) {
                const id = m?.material?.toString?.();
                if (id) materialsReferenced.add(id);
            }
        }
        const materialIds = Array.from(materialsReferenced).map((id) => new mongoose.Types.ObjectId(id));

        // Count remaining references for these materials in other elements of the project
        const remaining = await Element.aggregate([
            { $match: { projectId: upload.projectId, _id: { $nin: elementsToDeleteIds } } },
            { $unwind: "$materials" },
            { $match: { "materials.material": { $in: materialIds } } },
            { $group: { _id: "$materials.material", refs: { $sum: 1 } } },
        ]);
        const remainingMap = new Map(remaining.map((r: any) => [r._id.toString(), r.refs]));
        const orphanedIds = materialIds
            .map((oid) => oid.toString())
            .filter((id) => (remainingMap.get(id) ?? 0) === 0)
            .map((id) => new mongoose.Types.ObjectId(id));

        // Check which materials will become truly orphaned (no remaining references)
        const materialsToDelete = orphanedIds.length
            ? await Material.find({ _id: { $in: orphanedIds }, projectId: upload.projectId })
                .select("name _id")
                .lean()
            : [];

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

