"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageUploadProps {
  projectId: string;
  imageUrl?: string;
}

export function ImageUpload({ projectId, imageUrl }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      // Get upload URL
      const response = await fetch(`/api/projects/${projectId}/image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!response.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, blobUrl } = await response.json();

      // Upload to blob storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload image");

      // Update project with new image URL
      const updateResponse = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: blobUrl }),
      });

      if (!updateResponse.ok) throw new Error("Failed to update project");

      toast({
        title: "Success",
        description: "Project image updated successfully",
      });

      // Refresh the page to show new image
      window.location.reload();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>

      <CardContent>
        <div className="aspect-video flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors">
          {imageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt="Project image"
                fill
                className="object-cover rounded-lg"
              />
            </div>
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground mb-4 text-center px-2">
                No project image uploaded
              </p>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="relative overflow-hidden"
            disabled={isUploading}
          >
            <ImageIcon className="h-3 w-3 mr-2" />
            {isUploading ? "Uploading..." : "Upload"}
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
