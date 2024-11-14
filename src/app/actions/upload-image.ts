"use server";

import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { Project } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function uploadProjectImage(
  projectId: string,
  formData: FormData
) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    // Generate unique filename
    const filename = `${projectId}-${Date.now()}-${file.name}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });

    // Update project in MongoDB
    await connectToDatabase();
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { imageUrl: blob.url },
      { new: true }
    );

    if (!updatedProject) {
      throw new Error("Failed to update project");
    }

    // Revalidate the project page
    revalidatePath(`/projects/${projectId}`);
    return blob.url;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}
