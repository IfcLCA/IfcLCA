"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/api";
import { requireProject, updateProject } from "@/lib/repositories/projects";

export async function uploadProjectImage(projectId: string, formData: FormData) {
  const userId = await requireUserId();
  // Check ownership before storing anything in Blob.
  await requireProject(userId, projectId);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");

  const blob = await put(`${projectId}-${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });
  await updateProject(userId, projectId, { imageUrl: blob.url });

  revalidatePath(`/projects/${projectId}`);
  return blob.url;
}
