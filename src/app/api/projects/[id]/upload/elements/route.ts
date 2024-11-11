import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material } from "@/models";
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

    const { elements, uploadId } = await request.json();
    console.log("Processing elements for upload:", {
      projectId: params.id,
      uploadId,
      elementCount: elements.length,
      firstElement: elements[0],
    });

    // Verify database connection
    console.log("Connecting to database...");
    await connectToDatabase();
    console.log("Database connected");

    // Process elements in smaller batches
    const batchSize = 100;
    let savedCount = 0;

    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      console.log(
        `Processing batch ${i / batchSize + 1} of ${Math.ceil(
          elements.length / batchSize
        )}`
      );

      // Process each element in the batch
      const elementPromises = batch.map(async (element) => {
        try {
          // Create element
          const elementData = {
            projectId: params.id,
            uploadId: uploadId,
            guid: element.globalId,
            name: element.name,
            type: element.type,
            volume: element.netVolume,
            buildingStorey: element.spatialContainer,
          };

          console.log("Creating element:", elementData);

          const savedElement = await Element.create(elementData);
          console.log("Element saved:", {
            id: savedElement._id,
            name: savedElement.name,
          });

          savedCount++;
          return savedElement;
        } catch (error) {
          console.error("Failed to save element:", {
            error,
            element: element.name,
          });
          return null;
        }
      });

      const results = await Promise.all(elementPromises);
      console.log(
        `Batch complete. Saved ${results.filter(Boolean).length} elements`
      );
    }

    // Update upload status
    console.log("Updating upload status...");
    const updatedUpload = await Upload.findByIdAndUpdate(
      uploadId,
      {
        status: "Completed",
        elementCount: savedCount,
      },
      { new: true }
    );
    console.log("Upload status updated:", {
      uploadId,
      status: updatedUpload?.status,
      elementCount: updatedUpload?.elementCount,
    });

    return NextResponse.json({
      success: true,
      elementCount: savedCount,
    });
  } catch (error) {
    console.error("Failed to save elements:", error);
    return NextResponse.json(
      {
        error: "Failed to save elements",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
