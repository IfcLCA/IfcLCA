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
    console.log("Starting image upload for project:", projectId);

    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    // Generate unique filename
    const filename = `${projectId}-${Date.now()}-${file.name}`;
    console.log("Generated filename:", filename);

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });
    console.log("Blob upload successful:", blob.url);

    // Update project in MongoDB
    await connectToDatabase();
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { imageUrl: blob.url },
      { new: true }
    );
    console.log("Project updated with image URL:", updatedProject);

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
